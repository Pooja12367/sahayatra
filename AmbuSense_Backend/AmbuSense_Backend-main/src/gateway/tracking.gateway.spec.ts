import type { Model } from 'mongoose';
import { UserRole } from '../constants/enums';
import { AmbulanceService } from '../ambulance/ambulance.service';
import { AuthService } from '../auth/auth.service';
import { EmergencyRequestDocument } from '../emergency-request/entities/emergency-request.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import { UserDocument } from '../users/entities/user.entity';
import { TrackingGateway } from './tracking.gateway';
import type { Server, Socket } from 'socket.io';

function createGateway(
  user: Partial<UserDocument> | null,
  request: Record<string, unknown> | null = null,
) {
  const ambulanceId = '65f1a6f2c3b7a91d2e4f5680';
  const requestId = '65f1a6f2c3b7a91d2e4f5681';
  const ambulance = {
    id: ambulanceId,
    _id: ambulanceId,
    phone: user?.phone,
    isActive: true,
    currentLocation: { type: 'Point', coordinates: [85.324, 27.7172] },
    locationUpdatedAt: null,
  };
  const serverRoom = { emit: jest.fn() };
  const serverRequestRoom = { socketsLeave: jest.fn() };
  const server = {
    emit: jest.fn(),
    to: jest.fn().mockReturnValue(serverRoom),
    in: jest.fn().mockReturnValue(serverRequestRoom),
  } as unknown as Server;
  const ambulanceService = {
    findOne: jest.fn().mockResolvedValue(ambulance),
    findDriverAmbulance: jest.fn().mockResolvedValue(ambulance),
    updateDriverLocation: jest.fn().mockImplementation(
      async (_id: string, coordinates: [number, number], updatedAt: Date) => ({
        ...ambulance,
        currentLocation: { type: 'Point', coordinates },
        locationUpdatedAt: updatedAt,
      }),
    ),
  } as unknown as AmbulanceService;
  const authService = {
    getCurrentUser: jest.fn().mockResolvedValue(user),
  } as unknown as AuthService;
  const roleProfilesService = {
    assertDriverVerified: jest.fn().mockResolvedValue(undefined),
  } as unknown as RoleProfilesService;
  const emergencyRequestModel = {
    findById: jest.fn().mockResolvedValue(request),
    findOne: jest.fn().mockResolvedValue(request),
  } as unknown as Model<EmergencyRequestDocument>;
  const gateway = new TrackingGateway(
    ambulanceService,
    authService,
    roleProfilesService,
    emergencyRequestModel,
  );
  gateway.server = server;

  return {
    ambulance,
    ambulanceService,
    emergencyRequestModel,
    gateway,
    requestId,
    server,
    serverRequestRoom,
    serverRoom,
  };
}

function createSocket() {
  return {
    handshake: { headers: {} },
    join: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket;
}

describe('TrackingGateway request-scoped tracking', () => {
  it('lets only the owning patient join an active request room', async () => {
    const patientId = '65f1a6f2c3b7a91d2e4f5682';
    const request = {
      id: '65f1a6f2c3b7a91d2e4f5681',
      patient: patientId,
      assignedAmbulance: '65f1a6f2c3b7a91d2e4f5680',
      status: 'en-route',
    };
    const context = createGateway(
      { _id: patientId, role: UserRole.PATIENT } as unknown as UserDocument,
      request,
    );
    const socket = createSocket();

    const result = await context.gateway.handleTrackingRequestJoin(
      { requestId: context.requestId },
      socket,
    );

    expect(result).toMatchObject({
      ok: true,
      trackingActive: true,
      ambulanceId: context.ambulance.id,
      coordinates: [85.324, 27.7172],
    });
    expect(socket.join).toHaveBeenCalledWith(
      `tracking:request:${context.requestId}`,
    );
  });

  it('denies another patient access to a request tracking room', async () => {
    const context = createGateway(
      {
        _id: '65f1a6f2c3b7a91d2e4f5683',
        role: UserRole.PATIENT,
      } as unknown as UserDocument,
      {
        id: '65f1a6f2c3b7a91d2e4f5681',
        patient: '65f1a6f2c3b7a91d2e4f5682',
        assignedAmbulance: '65f1a6f2c3b7a91d2e4f5680',
        status: 'en-route',
      },
    );
    const socket = createSocket();

    const result = await context.gateway.handleTrackingRequestJoin(
      { requestId: context.requestId },
      socket,
    );

    expect(result).toEqual({ ok: false, error: 'Tracking unavailable' });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('does not join before the driver accepts an assigned request', async () => {
    const context = createGateway(
      {
        _id: '65f1a6f2c3b7a91d2e4f5682',
        role: UserRole.PATIENT,
      } as unknown as UserDocument,
      {
        id: '65f1a6f2c3b7a91d2e4f5681',
        patient: '65f1a6f2c3b7a91d2e4f5682',
        assignedAmbulance: '65f1a6f2c3b7a91d2e4f5680',
        status: 'assigned',
      },
    );
    const socket = createSocket();

    const result = await context.gateway.handleTrackingRequestJoin(
      { requestId: context.requestId },
      socket,
    );

    expect(result).toMatchObject({ ok: true, trackingActive: false });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('rejects driver GPS when the ambulance has no active assigned request', async () => {
    const driverId = '65f1a6f2c3b7a91d2e4f5684';
    const context = createGateway(
      {
        _id: driverId,
        role: UserRole.DRIVER,
        phone: '9817404665',
      } as unknown as UserDocument,
    );
    const socket = createSocket();

    const result = await context.gateway.handleAmbulanceLocationSend(
      {
        ambulanceId: context.ambulance.id,
        requestId: context.requestId,
        coordinates: [85.4, 27.8],
        timestamp: new Date().toISOString(),
      },
      socket,
    );

    expect(result).toEqual({
      ok: false,
      error: 'No active trip assigned to this driver',
    });
    expect(context.ambulanceService.updateDriverLocation).not.toHaveBeenCalled();
    expect(context.server.to).not.toHaveBeenCalled();
  });

  it('persists and emits GPS only to the assigned request room', async () => {
    const driverId = '65f1a6f2c3b7a91d2e4f5684';
    const context = createGateway(
      {
        _id: driverId,
        role: UserRole.DRIVER,
        phone: '9817404665',
      } as unknown as UserDocument,
      {
        id: '65f1a6f2c3b7a91d2e4f5681',
        assignedAmbulance: '65f1a6f2c3b7a91d2e4f5680',
        status: 'en-route',
      },
    );
    const socket = createSocket();
    const timestamp = new Date().toISOString();

    const result = await context.gateway.handleAmbulanceLocationSend(
      {
        ambulanceId: context.ambulance.id,
        requestId: context.requestId,
        coordinates: [85.4, 27.8],
        timestamp,
      },
      socket,
    );

    expect(result).toEqual({ ok: true });
    expect(context.ambulanceService.updateDriverLocation).toHaveBeenCalledWith(
      context.ambulance.id,
      [85.4, 27.8],
      new Date(timestamp),
    );
    expect(context.server.to).toHaveBeenCalledWith(
      `tracking:request:${context.requestId}`,
    );
    expect(context.serverRoom.emit).toHaveBeenCalledWith(
      'tracking.location.updated',
      expect.objectContaining({
        requestId: context.requestId,
        ambulanceId: context.ambulance.id,
        driverId,
        coordinates: [85.4, 27.8],
      }),
    );
    expect(context.server.emit).not.toHaveBeenCalled();
  });

  it('does not route one request location to another request on the same ambulance', async () => {
    const driverId = '65f1a6f2c3b7a91d2e4f5684';
    const requestAId = '65f1a6f2c3b7a91d2e4f5681';
    const requestBId = '65f1a6f2c3b7a91d2e4f5685';
    const context = createGateway(
      {
        _id: driverId,
        role: UserRole.DRIVER,
        phone: '9817404665',
      } as unknown as UserDocument,
      {
        id: requestAId,
        assignedAmbulance: '65f1a6f2c3b7a91d2e4f5680',
        status: 'en-route',
      },
    );
    const socket = createSocket();
    const timestamp = new Date().toISOString();
    context.emergencyRequestModel.findOne = jest.fn().mockResolvedValue(null);

    const result = await context.gateway.handleAmbulanceLocationSend(
      {
        ambulanceId: context.ambulance.id,
        requestId: requestBId,
        coordinates: [85.4, 27.8],
        timestamp,
      },
      socket,
    );

    expect(result).toEqual({
      ok: false,
      error: 'No active trip assigned to this driver',
    });
    expect(context.emergencyRequestModel.findOne).toHaveBeenCalledWith({
      _id: requestBId,
      assignedAmbulance: context.ambulance._id,
      status: {
        $in: ['en-route', 'at-patient', 'transporting', 'at-hospital'],
      },
    });
    expect(
      context.ambulanceService.updateDriverLocation,
    ).not.toHaveBeenCalled();
    expect(context.server.to).not.toHaveBeenCalled();
  });

  it('rejects GPS from an unauthenticated socket', async () => {
    const context = createGateway(null);
    const socket = createSocket();

    const result = await context.gateway.handleAmbulanceLocationSend(
      {
        ambulanceId: context.ambulance.id,
        requestId: context.requestId,
        coordinates: [85.4, 27.8],
        timestamp: new Date().toISOString(),
      },
      socket,
    );

    expect(result).toMatchObject({ ok: false });
    expect(context.ambulanceService.updateDriverLocation).not.toHaveBeenCalled();
  });

  it('removes existing room members when a request is dispatched again', () => {
    const context = createGateway({ role: UserRole.ADMIN } as UserDocument);

    context.gateway.emitEmergencyRequestDispatched({
      id: context.requestId,
      status: 'assigned',
    } as EmergencyRequestDocument);

    expect(context.server.to).toHaveBeenCalledWith(
      `tracking:request:${context.requestId}`,
    );
    expect(context.serverRequestRoom.socketsLeave).toHaveBeenCalledWith(
      `tracking:request:${context.requestId}`,
    );
  });
});