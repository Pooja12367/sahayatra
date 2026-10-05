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
import { UserRole } from '../constants/enums';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from '../emergency-request/entities/emergency-request.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import { UserDocument } from '../users/entities/user.entity';
import { validatePublicUrl } from '../config/public-url';

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  const isProduction = process.env.NODE_ENV === 'production';

  const allowedOrigins = isProduction
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  if (!isProduction) {
    allowedOrigins.push(
      'https://ambu-sense-frontend.vercel.app',
      'https://ambusense-frontend.vercel.app',
    );
  }

  const configuredFrontendUrl =
    process.env.FRONTEND_URL ??
    (!isProduction
      ? (process.env.APP_FRONTEND_URL ?? process.env.PUBLIC_FRONTEND_URL)
      : undefined);

  if (configuredFrontendUrl) {
    allowedOrigins.push(
      validatePublicUrl(configuredFrontendUrl, 'FRONTEND_URL', isProduction)
        .origin,
    );
  } else if (isProduction) {
    return false;
  }

  return allowedOrigins.includes(origin);
}

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  },
})
export class TrackingGateway {
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

  private readonly ACTIVE_TRACKING_STATUSES = [
    'en-route',
    'at-patient',
    'transporting',
    'at-hospital',
  ];

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
        $or: [{ assignedDriverId: user._id }, { assignedDriverId: null }],
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

      this.server
        .to(this.trackingRoom(request.id))
        .emit('tracking.location.updated', {
          requestId: request.id,
          ambulanceId: updated.id,
          driverId: user?._id.toString() ?? null,
          coordinates: updated.currentLocation.coordinates,
          accuracy: payload.accuracy,
          timestamp: updated.locationUpdatedAt,
        });

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

    const ambulance = await this.ambulanceService.findDriverAmbulance(user);

    if (ambulance.id !== ambulanceId || !ambulance.isActive) {
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
      if (request.assignedDriverId) {
        return request.assignedDriverId.toString() === user._id.toString();
      }
      if (!request.assignedAmbulance) return false;
      const ambulance = await this.ambulanceService.findDriverAmbulance(user);
      if (request.assignedAmbulance.toString() !== ambulance.id) {
        return false;
      }
      return ambulance.driverId
        ? ambulance.driverId.toString() === user._id.toString()
        : true;
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
