import {
  ForbiddenException,
  Inject,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Request } from 'express';
import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { AmbulanceService } from '../ambulance/ambulance.service';
import { AmbulanceDocument } from '../ambulance/entities/ambulance.entity';
import { AuthService } from '../auth/auth.service';
import { AmbulanceStatus, UserRole } from '../constants/enums';
import { EmergencyRequestDocument } from '../emergency-request/entities/emergency-request.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import { UserDocument } from '../users/entities/user.entity';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://ambu-sense-frontend.vercel.app',
      'https://ambusense-frontend.vercel.app',
    ],
    credentials: true,
  },
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(forwardRef(() => AmbulanceService))
    private readonly ambulanceService: AmbulanceService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly roleProfilesService: RoleProfilesService,
  ) {}

  /** Map socket.id -> UserDocument for online drivers */
  private readonly connectedDrivers = new Map<string, UserDocument>();

  /**
   * Pending "go offline" timers keyed by driver phone number.
   * Cancelled if the same driver reconnects within the grace period.
   */
  private readonly offlineTimers = new Map<string, NodeJS.Timeout>();

  /** How long (ms) to wait before marking a driver's ambulance OFFLINE after disconnect */
  private readonly OFFLINE_GRACE_MS = 12_000;

  async handleConnection(client: Socket) {
    try {
      const user = await this.authService.getCurrentUser({
        headers: client.handshake.headers,
      } as Request);

      if (user?.role === UserRole.DRIVER) {
        this.connectedDrivers.set(client.id, user);

        // Cancel any pending offline timer for this driver (reconnect within grace period)
        const pending = this.offlineTimers.get(user.phone);
        if (pending) {
          clearTimeout(pending);
          this.offlineTimers.delete(user.phone);
          console.log(
            `[Gateway] Driver ${user.phone} reconnected — offline timer cancelled`,
          );
        }
      }
    } catch {
      // Not authenticated — ignore, only tracking connections matter
    }
  }

  async handleDisconnect(client: Socket) {
    const user = this.connectedDrivers.get(client.id);
    this.connectedDrivers.delete(client.id);

    if (!user) {
      return;
    }

    // Check if this driver still has another active socket connection
    // (multiple tabs or a reconnect already in flight)
    const stillConnected = [...this.connectedDrivers.values()].some(
      (u) => u.phone === user.phone,
    );

    if (stillConnected) {
      return;
    }

    // Debounce: only go offline after a grace period so that brief
    // disconnects (page navigations, refreshes) don't flip the status.
    const existing = this.offlineTimers.get(user.phone);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.offlineTimers.delete(user.phone);

      // Check again — driver may have reconnected while the timer was running
      const reconnected = [...this.connectedDrivers.values()].some(
        (u) => u.phone === user.phone,
      );
      if (reconnected) return;

      try {
        const ambulance = await this.ambulanceService.findDriverAmbulance(user);

        if (
          ambulance.status === 'available' ||
          ambulance.status === 'completed'
        ) {
          await this.ambulanceService.updateStatusDirectly(
            ambulance.id,
            AmbulanceStatus.OFFLINE,
          );
          console.log(
            `[Gateway] Driver ${user.phone} offline — ambulance ${ambulance.ambulanceCode} set to OFFLINE`,
          );
        }
      } catch {
        // Driver may not have an ambulance — silently ignore
      }
    }, this.OFFLINE_GRACE_MS);

    this.offlineTimers.set(user.phone, timer);
    console.log(
      `[Gateway] Driver ${user.phone} disconnected — offline in ${this.OFFLINE_GRACE_MS / 1000}s if no reconnect`,
    );
  }

  @SubscribeMessage('ambulance.location.send')
  async handleAmbulanceLocationSend(
    @MessageBody()
    payload: {
      ambulanceId: string;
      coordinates: [number, number];
      accuracy?: number;
      timestamp?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = await this.authenticateLocationSender(client);
      await this.assertCanUpdateAmbulanceLocation(user, payload.ambulanceId);

      const current = await this.ambulanceService.findOne(payload.ambulanceId);

      const [oldLng, oldLat] = current.currentLocation.coordinates;
      const [newLng, newLat] = payload.coordinates;

      const sameLocation = oldLng === newLng && oldLat === newLat;

      if (sameLocation) {
        return { ok: true, skipped: true };
      }

      const updated = await this.ambulanceService.update(payload.ambulanceId, {
        coordinates: payload.coordinates,
      });

      const outgoing = {
        id: updated.id,
        currentLocation: updated.currentLocation,
        status: updated.status,
        accuracy: payload.accuracy,
        timestamp: payload.timestamp,
      };

      this.server.emit('ambulance.location.updated', outgoing);

      return { ok: true };
    } catch {
      return { ok: false, error: 'failed to update location' };
    }
  }

  private async authenticateLocationSender(client: Socket) {
    if (this.isSystemSocket(client)) {
      return null;
    }

    try {
      return await this.authService.getCurrentUser({
        headers: client.handshake.headers,
      } as Request);
    } catch {
      throw new UnauthorizedException('Socket authentication required');
    }
  }

  private isSystemSocket(client: Socket) {
    const expectedToken = this.configService.get<string>('SOCKET_SYSTEM_TOKEN');

    if (!expectedToken) {
      return false;
    }

    const authToken = client.handshake.auth?.systemToken;
    const headerToken = client.handshake.headers['x-system-token'];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    return authToken === expectedToken || token === expectedToken;
  }

  private async assertCanUpdateAmbulanceLocation(
    user: UserDocument | null,
    ambulanceId: string,
  ) {
    if (!user || user.role === UserRole.ADMIN) {
      return;
    }

    if (user.role !== UserRole.DRIVER) {
      throw new ForbiddenException(
        'Only drivers can update ambulance location',
      );
    }

    await this.roleProfilesService.assertDriverVerified(
      user._id as Types.ObjectId,
    );

    const ambulance = await this.ambulanceService.findOne(ambulanceId);

    if (ambulance.phone !== user.phone || !ambulance.isActive) {
      throw new ForbiddenException('Cannot update another driver ambulance');
    }
  }

  emitAmbulanceUpdated(ambulance: AmbulanceDocument) {
    this.server.emit('ambulance.updated', ambulance);
  }

  emitAmbulanceLocationUpdated(payload: {
    id: string;
    currentLocation: {
      type: 'Point';
      coordinates: [number, number];
    };
    status: string;
    updatedAt: Date;
  }) {
    this.server.emit('ambulance.location.updated', payload);
  }

  emitAmbulanceStatusUpdated(payload: {
    id: string;
    status: string;
    assignedAt: Date | null;
    reachedPatientAt: Date | null;
    transportStartedAt: Date | null;
    reachedHospitalAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
  }) {
    this.server.emit('ambulance.status.updated', payload);
  }

  emitEmergencyRequestCreated(request: EmergencyRequestDocument) {
    this.server.emit('emergency.request.created', request);
  }

  emitEmergencyRequestUpdated(request: EmergencyRequestDocument) {
    this.server.emit('emergency.request.updated', request);
  }

  emitEmergencyRequestDispatched(request: EmergencyRequestDocument) {
    this.server.emit('emergency.request.dispatched', request);
  }

  emitEmergencyRequestCancelled(request: EmergencyRequestDocument) {
    this.server.emit('emergency.request.cancelled', request);
  }

  emitEmergencyRequestDeleted(payload: { id: string }) {
    this.server.emit('emergency.request.deleted', payload);
  }
}
