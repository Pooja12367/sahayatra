import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Model, Types } from 'mongoose';
import { AmbulanceDocument } from '../ambulance/entities/ambulance.entity';
import {
  AmbulanceStatus,
  EmergencyRequestStatus,
  HospitalAssignmentTechnique,
} from '../constants/enums';
import { HospitalDocument } from '../hospital/entities/hospital.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import type { UserDocument } from '../users/entities/user.entity';
import { EmergencyRequestDocument } from './entities/emergency-request.entity';
import { EmergencyRequestService } from './emergency-request.service';

type DispatchTestInternals = {
  resolveHospitalForDispatch: jest.Mock;
  claimNearestAvailableAmbulance: jest.Mock;
  reserveHospitalBed: jest.Mock;
  findDriverIdForAmbulance: jest.Mock;
  findOne: jest.Mock;
  emitEmergencyRequestDispatched: jest.Mock;
};

function makeTripQuery(result: unknown[]) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
}

describe('EmergencyRequestService dispatch', () => {
  const requestId = new Types.ObjectId();
  const hospitalId = new Types.ObjectId();
  const ambulanceId = new Types.ObjectId();
  const driverId = new Types.ObjectId();

  function makeService(request: Partial<EmergencyRequestDocument>) {
    const requestDocument = {
      _id: requestId,
      id: requestId.toString(),
      status: EmergencyRequestStatus.PENDING,
      pickupLocation: {
        type: 'Point',
        coordinates: [85.324, 27.7172],
      },
      assignedAmbulance: null,
      assignedDriverId: null,
      assignedHospital: null,
      save: jest.fn().mockResolvedValue(undefined),
      ...request,
    };
    const emergencyRequestModel = {
      findById: jest.fn().mockResolvedValue(requestDocument),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      {} as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
      {} as Model<UserDocument>,
    );
    const internals = service as unknown as DispatchTestInternals;
    internals.resolveHospitalForDispatch = jest.fn().mockResolvedValue({
      _id: hospitalId,
    });
    internals.claimNearestAvailableAmbulance = jest.fn().mockResolvedValue({
      _id: ambulanceId,
      status: AmbulanceStatus.ASSIGNED,
    });
    internals.reserveHospitalBed = jest.fn().mockResolvedValue(true);
    internals.findDriverIdForAmbulance = jest.fn().mockResolvedValue(driverId);
    internals.findOne = jest.fn().mockResolvedValue({
      id: requestId.toString(),
      status: EmergencyRequestStatus.ASSIGNED,
    });
    internals.emitEmergencyRequestDispatched = jest.fn();

    return { service, internals, requestDocument };
  }

  const dispatchDto = {
    hospitalAssignmentTechnique: HospitalAssignmentTechnique.SYSTEM_AUTO,
  };

  it('stores unique ambulance and driver IDs on a dispatched request', async () => {
    const { service, internals, requestDocument } = makeService({
      assignedHospital: hospitalId,
    });

    const result = await service.dispatch(requestId.toString(), dispatchDto);

    expect(requestDocument.status).toBe(EmergencyRequestStatus.ASSIGNED);
    expect(requestDocument.assignedAmbulance).toBe(ambulanceId);
    expect(requestDocument.assignedDriverId).toBe(driverId);
    expect(requestDocument.assignedHospital).toBe(hospitalId);
    expect(requestDocument.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(EmergencyRequestStatus.ASSIGNED);
    expect(internals.emitEmergencyRequestDispatched).toHaveBeenCalledWith(
      result,
    );
  });

  it('rejects a request whose status is already assigned', async () => {
    const { service, internals } = makeService({
      status: EmergencyRequestStatus.ASSIGNED,
      assignedAmbulance: ambulanceId,
    });

    await expect(
      service.dispatch(requestId.toString(), dispatchDto),
    ).rejects.toThrow(
      new BadRequestException('Emergency request is already dispatched'),
    );
    expect(internals.resolveHospitalForDispatch).not.toHaveBeenCalled();
  });

  it('does not label a cancelled request as already dispatched', async () => {
    const { service, internals } = makeService({
      status: EmergencyRequestStatus.CANCELLED,
      assignedHospital: hospitalId,
    });

    await expect(
      service.dispatch(requestId.toString(), dispatchDto),
    ).rejects.toThrow(
      new BadRequestException(
        'Cancelled emergency request cannot be dispatched',
      ),
    );
    expect(internals.resolveHospitalForDispatch).not.toHaveBeenCalled();
  });

  it('reports no available ambulance for an undispatched request', async () => {
    const { service, internals } = makeService({
      assignedHospital: hospitalId,
    });
    internals.claimNearestAvailableAmbulance.mockResolvedValue(null);

    await expect(
      service.dispatch(requestId.toString(), dispatchDto),
    ).rejects.toThrow(new NotFoundException('No available ambulance found'));
    expect(internals.findDriverIdForAmbulance).not.toHaveBeenCalled();
  });
});

describe('EmergencyRequestService driver trips', () => {
  it('returns an empty active-trip list when the verified driver has no ambulance', async () => {
    const userId = new Types.ObjectId();
    const emptyQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const noAmbulanceQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const service = new EmergencyRequestService(
      {
        find: jest.fn().mockReturnValue(emptyQuery),
      } as unknown as Model<EmergencyRequestDocument>,
      {
        find: jest.fn().mockReturnValue(noAmbulanceQuery),
      } as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {
        assertDriverVerified: jest.fn().mockResolvedValue(undefined),
      } as unknown as RoleProfilesService,
      {} as Model<UserDocument>,
    );

    await expect(
      service.findMyTrip({
        _id: userId,
        phone: '+9779812345678',
      } as UserDocument),
    ).resolves.toEqual([]);
  });

  it('loads the active request by the authenticated unique driver ID', async () => {
    const userId = new Types.ObjectId();
    const trip = { _id: new Types.ObjectId(), status: 'at-patient' };
    const tripQuery = makeTripQuery([trip]);
    const emergencyRequestModel = {
      find: jest.fn().mockReturnValue(tripQuery),
    };
    const ambulanceModel = { find: jest.fn() };
    const roleProfilesService = {
      assertDriverVerified: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      roleProfilesService as unknown as RoleProfilesService,
      {} as Model<UserDocument>,
    );

    await expect(
      service.findMyTrip({
        _id: userId,
        fullName: 'Shared Driver Name',
        phone: '9812345678',
      } as UserDocument),
    ).resolves.toEqual([trip]);

    expect(emergencyRequestModel.find).toHaveBeenCalledWith({
      assignedDriverId: userId,
      status: {
        $in: [
          EmergencyRequestStatus.ASSIGNED,
          EmergencyRequestStatus.EN_ROUTE,
          EmergencyRequestStatus.AT_PATIENT,
          EmergencyRequestStatus.TRANSPORTING,
          EmergencyRequestStatus.AT_HOSPITAL,
        ],
      },
    });
    expect(ambulanceModel.find).not.toHaveBeenCalled();
    expect(tripQuery.populate).toHaveBeenCalledWith('assignedAmbulance');
    expect(tripQuery.populate).toHaveBeenCalledWith('assignedHospital');
    expect(tripQuery.limit).toHaveBeenCalledWith(2);
  });

  it('rejects multiple active assignments for one driver', async () => {
    const userId = new Types.ObjectId();
    const tripQuery = makeTripQuery([{}, {}]);
    const service = new EmergencyRequestService(
      {
        find: jest.fn().mockReturnValue(tripQuery),
      } as unknown as Model<EmergencyRequestDocument>,
      {} as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
      {} as Model<UserDocument>,
    );

    await expect(
      service.findMyTrip({
        _id: userId,
        phone: '9812345678',
      } as UserDocument),
    ).rejects.toThrow(
      new ConflictException('Driver has more than one active trip assignment'),
    );
  });

  it('uses the exact phone relationship for legacy ambulance records', async () => {
    const ambulance = { _id: new Types.ObjectId() };
    const byDriverIdQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const ambulanceQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([ambulance]),
    };
    const ambulanceModel = {
      find: jest
        .fn()
        .mockReturnValueOnce(byDriverIdQuery)
        .mockReturnValueOnce(ambulanceQuery),
    };
    const service = new EmergencyRequestService(
      {} as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
      {} as Model<UserDocument>,
    );
    const internals = service as unknown as {
      findDriverAmbulance: (user: UserDocument) => Promise<AmbulanceDocument>;
    };

    await expect(
      internals.findDriverAmbulance({
        fullName: 'Shared Driver Name',
        phone: '+9779876543667',
      } as UserDocument),
    ).resolves.toBe(ambulance);

    expect(ambulanceModel.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        phone: {
          $in: expect.arrayContaining([
            '+9779876543667',
            '9876543667',
            '09876543667',
            '9779876543667',
            '009779876543667',
          ]),
        },
        isActive: true,
      }),
    );
    expect(ambulanceQuery.limit).toHaveBeenCalledWith(2);
  });

  it('updates the request ID supplied by the driver trip page', async () => {
    const requestId = new Types.ObjectId();
    const user = {} as UserDocument;
    const request = { id: requestId.toString() };
    const emergencyRequestModel = {
      findById: jest.fn().mockResolvedValue(request),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      {} as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
      {} as Model<UserDocument>,
    );
    const updateStatus = jest
      .spyOn(service, 'updateStatus')
      .mockResolvedValue(undefined as never);

    await service.updateMyTripStatus(
      user,
      requestId.toString(),
      EmergencyRequestStatus.EN_ROUTE,
    );

    expect(emergencyRequestModel.findById).toHaveBeenCalledWith(
      requestId.toString(),
    );
    expect(updateStatus).toHaveBeenCalledWith(
      requestId.toString(),
      EmergencyRequestStatus.EN_ROUTE,
      user,
    );
  });
});
