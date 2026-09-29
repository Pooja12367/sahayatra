import {
  ForbiddenException,
  Inject,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
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
import { Model, Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { AmbulanceService } from '../ambulance/ambulance.service';
import { AmbulanceDocument } from '../ambulance/entities/ambulance.entity';
import { AuthService } from '../auth/auth.service';
import { AmbulanceStatus, UserRole } from '../constants/enums';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from '../emergency-request/entities/emergency-request.entity';
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
    private readonly roleProfilesService: RoleProfilesService,
    @InjectModel(EmergencyRequest.name)
    private readonly emergencyRequestModel: Model<EmergencyRequestDocument>,
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

  private readonly ACTIVE_TRACKING_STATUSES = [
    'en-route',
    'at-patient',
    'transporting',
    'at-hospital',
  ];

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

  @SubscribeMessage('tracking.request.join')
  async handleTrackingRequestJoin(
    @MessageBody() payload: { requestId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = await this.authService.getCurrentUser({
        headers: client.handshake.headers,
      } as Request);

      if (!user || !Types.ObjectId.isValid(payload?.requestId)) {
        return { ok: false, error: 'Tracking unavailable' };
      }

      const request = await this.emergencyRequestModel.findById(
        payload.requestId,
      );
      if (!request || !(await this.canViewTrackingRequest(user, request))) {
        return { ok: false, error: 'Tracking unavailable' };
      }

      const ambulance = request.assignedAmbulance
        ? await this.ambulanceService.findOne(
            request.assignedAmbulance.toString(),
          )
        : null;
      const trackingActive = Boolean(
        ambulance && this.ACTIVE_TRACKING_STATUSES.includes(request.status),
      );

      if (trackingActive) {
        await client.join(this.trackingRoom(request.id));
      }

      return {
        ok: true,
        trackingActive,
        ambulanceId: ambulance?.id,
        coordinates: trackingActive
          ? ambulance?.currentLocation.coordinates
          : undefined,
        locationUpdatedAt: trackingActive
          ? ambulance?.locationUpdatedAt
          : undefined,
      };
    } catch {
      return { ok: false, error: 'Tracking unavailable' };
    }
  }

  @SubscribeMessage('tracking.request.leave')
  handleTrackingRequestLeave(
    @MessageBody() payload: { requestId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (Types.ObjectId.isValid(payload?.requestId)) {
      void client.leave(this.trackingRoom(payload.requestId));
    }
  }

  @SubscribeMessage('ambulance.location.send')
  async handleAmbulanceLocationSend(
    @MessageBody()
    payload: {
      ambulanceId: string;
      requestId: string;
      coordinates: [number, number];
      accuracy?: number;
      timestamp?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const user = await this.authenticateLocationSender(client);
      await this.assertCanUpdateAmbulanceLocation(user, payload.ambulanceId);

      const [longitude, latitude] = payload.coordinates ?? [];
      if (
        !Types.ObjectId.isValid(payload.requestId) ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180 ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        return { ok: false, error: 'Invalid location update' };
      }

      const reportedAt = payload.timestamp
        ? Date.parse(payload.timestamp)
        : Number.NaN;
      const now = Date.now();
      if (
        !Number.isFinite(reportedAt) ||
        reportedAt > now + 15_000 ||
        now - reportedAt > 60_000
      ) {
        return { ok: false, error: 'Stale location update' };
      }

      const current = await this.ambulanceService.findOne(payload.ambulanceId);
      const request = await this.emergencyRequestModel.findOne({
        _id: payload.requestId,
        assignedAmbulance: current._id,
        status: { $in: this.ACTIVE_TRACKING_STATUSES },
      });

      if (!request) {
        return { ok: false, error: 'No active trip assigned to this driver' };
      }

      if (
        current.locationUpdatedAt &&
        reportedAt <= current.locationUpdatedAt.getTime()
      ) {
        return { ok: true, skipped: true };
      }

      const updated = await this.ambulanceService.updateDriverLocation(
        payload.ambulanceId,
        payload.coordinates,
        new Date(reportedAt),
      );

      this.server.to(this.trackingRoom(request.id)).emit(
        'tracking.location.updated',
        {
          requestId: request.id,
          ambulanceId: updated.id,
          driverId: user?._id.toString() ?? null,
          coordinates: updated.currentLocation.coordinates,
          accuracy: payload.accuracy,
          timestamp: updated.locationUpdatedAt,
        },
      );

      return { ok: true };
    } catch {
      return { ok: false, error: 'failed to update location' };
    }
  }

  private async authenticateLocationSender(client: Socket) {
    try {
      const user = await this.authService.getCurrentUser({
        headers: client.handshake.headers,
      } as Request);
      if (!user) {
        throw new UnauthorizedException('Socket authentication required');
      }
      return user;
    } catch {
      throw new UnauthorizedException('Socket authentication required');
    }
  }

  private async assertCanUpdateAmbulanceLocation(
    user: UserDocument,
    ambulanceId: string,
  ) {
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

  private async canViewTrackingRequest(
    user: UserDocument,
    request: EmergencyRequestDocument,
  ) {
    if (user.role === UserRole.PATIENT) {
      return request.patient?.toString() === user._id.toString();
    }

    if (user.role === UserRole.DRIVER) {
      await this.roleProfilesService.assertDriverVerified(
        user._id as Types.ObjectId,
      );
      if (!request.assignedAmbulance) return false;
      const ambulance = await this.ambulanceService.findDriverAmbulance(user);
      return request.assignedAmbulance.toString() === ambulance.id;
    }

    return user.role === UserRole.ADMIN || user.role === UserRole.DISPATCHER;
  }

  private trackingRoom(requestId: string) {
    return `tracking:request:${requestId}`;
  }

  emitAmbulanceUpdated(ambulance: AmbulanceDocument) {
    this.server.emit('ambulance.updated', {
      id: ambulance.id,
      status: ambulance.status,
    });
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
    this.server.emit('emergency.request.created', { id: request.id });
  }

  emitEmergencyRequestUpdated(request: EmergencyRequestDocument) {
    this.server.emit('emergency.request.updated', { id: request.id });
    if (
      !request.assignedAmbulance ||
      ['completed', 'cancelled'].includes(request.status)
    ) {
      this.stopTracking(request.id, request.status);
    }
  }

  emitEmergencyRequestDispatched(request: EmergencyRequestDocument) {
    this.stopTracking(request.id, request.status);
    this.server.emit('emergency.request.dispatched', { id: request.id });
  }

  emitEmergencyRequestCancelled(request: EmergencyRequestDocument) {
    this.server.emit('emergency.request.cancelled', { id: request.id });
    this.stopTracking(request.id, request.status);
  }

  emitEmergencyRequestDeleted(payload: { id: string }) {
    this.server.emit('emergency.request.deleted', payload);
    this.stopTracking(payload.id, 'deleted');
  }

  private stopTracking(requestId: string, status: string) {
    const room = this.trackingRoom(requestId);
    this.server.to(room).emit('tracking.stopped', { requestId, status });
    this.server.in(room).socketsLeave(room);
  }
}
