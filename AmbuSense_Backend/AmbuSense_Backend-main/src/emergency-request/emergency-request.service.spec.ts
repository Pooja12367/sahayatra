import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Model, Types } from 'mongoose';
import {
  Ambulance,
  AmbulanceDocument,
} from '../ambulance/entities/ambulance.entity';
import {
  AmbulanceStatus,
  EmergencyRequestStatus,
  HospitalAssignmentTechnique,
} from '../constants/enums';
import {
  Hospital,
  HospitalDocument,
} from '../hospital/entities/hospital.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from './entities/emergency-request.entity';
import { EmergencyRequestService } from './emergency-request.service';
import type { UserDocument } from '../users/entities/user.entity';

type DispatchTestInternals = {
  resolveHospitalForDispatch: jest.Mock;
  claimNearestAvailableAmbulance: jest.Mock;
  reserveHospitalBed: jest.Mock;
  findOne: jest.Mock;
  emitEmergencyRequestDispatched: jest.Mock;
};

describe('EmergencyRequestService dispatch', () => {
  const requestId = new Types.ObjectId();
  const hospitalId = new Types.ObjectId();
  const ambulanceId = new Types.ObjectId();

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

  it('dispatches a pending request that already has a preselected hospital', async () => {
    const { service, internals, requestDocument } = makeService({
      assignedHospital: hospitalId,
    });

    const result = await service.dispatch(requestId.toString(), dispatchDto);

    expect(requestDocument.status).toBe(EmergencyRequestStatus.ASSIGNED);
    expect(requestDocument.assignedAmbulance).toBe(ambulanceId);
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

  it('reports no available ambulance for an undispatched pending request', async () => {
    const { service, internals } = makeService({
      assignedHospital: hospitalId,
    });
    internals.claimNearestAvailableAmbulance.mockResolvedValue(null);

    await expect(
      service.dispatch(requestId.toString(), dispatchDto),
    ).rejects.toThrow(new NotFoundException('No available ambulance found'));
  });
});

describe('EmergencyRequestService driver ambulance lookup', () => {
  it('prefers the ambulance referenced by the active request over completed duplicates', async () => {
    const completedAmbulance = {
      _id: new Types.ObjectId(),
      status: AmbulanceStatus.COMPLETED,
    };
    const assignedAmbulance = {
      _id: new Types.ObjectId(),
      status: AmbulanceStatus.ASSIGNED,
    };
    const nameQuery = {
      exec: jest
        .fn()
        .mockResolvedValue([completedAmbulance, assignedAmbulance]),
    };
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(nameQuery),
      findOne: jest.fn(),
    };
    const emergencyRequestModel = {
      distinct: jest.fn().mockResolvedValue([assignedAmbulance._id]),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );
    const findDriverAmbulance = service as unknown as {
      findDriverAmbulance: (user: {
        fullName: string;
        phone: string;
      }) => Promise<AmbulanceDocument>;
    };

    await expect(
      findDriverAmbulance.findDriverAmbulance({
        fullName: 'Pooja Shrestha',
        phone: '+9779876543667',
      }),
    ).resolves.toBe(assignedAmbulance);
    expect(emergencyRequestModel.distinct).toHaveBeenCalledWith(
      'assignedAmbulance',
      expect.objectContaining({
        assignedAmbulance: {
          $in: [completedAmbulance._id, assignedAmbulance._id],
        },
        status: {
          $in: [
            EmergencyRequestStatus.ASSIGNED,
            EmergencyRequestStatus.EN_ROUTE,
            EmergencyRequestStatus.AT_PATIENT,
            EmergencyRequestStatus.TRANSPORTING,
            EmergencyRequestStatus.AT_HOSPITAL,
          ],
        },
      }),
    );
  });

  it('ignores completed ambulance history when there is no active request', async () => {
    const completedAmbulance = {
      _id: new Types.ObjectId(),
      status: AmbulanceStatus.COMPLETED,
    };
    const availableAmbulance = {
      _id: new Types.ObjectId(),
      status: AmbulanceStatus.AVAILABLE,
    };
    const nameQuery = {
      exec: jest
        .fn()
        .mockResolvedValue([completedAmbulance, availableAmbulance]),
    };
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(nameQuery),
      findOne: jest.fn(),
    };
    const emergencyRequestModel = {
      distinct: jest.fn().mockResolvedValue([]),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );
    const findDriverAmbulance = service as unknown as {
      findDriverAmbulance: (user: {
        fullName: string;
        phone: string;
      }) => Promise<AmbulanceDocument>;
    };

    await expect(
      findDriverAmbulance.findDriverAmbulance({
        fullName: 'Pooja Shrestha',
        phone: '+9779876543667',
      }),
    ).resolves.toBe(availableAmbulance);
  });

  it('reports no ambulance when the driver has no matching assignment', async () => {
    const nameQuery = {
      exec: jest.fn().mockResolvedValue([]),
    };
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(nameQuery),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new EmergencyRequestService(
      {} as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );
    const findDriverAmbulance = service as unknown as {
      findDriverAmbulance: (user: {
        fullName: string;
        phone: string;
      }) => Promise<AmbulanceDocument>;
    };

    await expect(
      findDriverAmbulance.findDriverAmbulance({
        fullName: 'Unassigned Driver',
        phone: '+9779876543667',
      }),
    ).rejects.toThrow('Driver ambulance not found');
  });

  it('fetches assigned trips for the uniquely matched driver ambulance', async () => {
    const userId = new Types.ObjectId();
    const ambulanceId = new Types.ObjectId();
    const ambulance = { _id: ambulanceId };
    const trip = { _id: new Types.ObjectId(), status: 'assigned' };
    const nameQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([ambulance]),
    };
    const tripQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([trip]),
    };
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(nameQuery),
    };
    const emergencyRequestModel = {
      find: jest.fn().mockReturnValue(tripQuery),
      distinct: jest.fn().mockResolvedValue([]),
    };
    const roleProfilesService = {
      assertDriverVerified: jest.fn().mockResolvedValue(undefined),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      roleProfilesService as unknown as RoleProfilesService,
    );

    const result = await service.findMyTrip({
      _id: userId,
      fullName: 'Pooja Shrestha',
      phone: '+9779876543667',
    } as UserDocument);

    expect(result).toEqual([trip]);
    expect(emergencyRequestModel.find).toHaveBeenCalledWith({
      assignedAmbulance: ambulanceId,
      status: {
        $nin: [
          EmergencyRequestStatus.COMPLETED,
          EmergencyRequestStatus.CANCELLED,
        ],
      },
    });
    expect(tripQuery.populate).toHaveBeenCalledWith('assignedAmbulance');
    expect(tripQuery.populate).toHaveBeenCalledWith('assignedHospital');
  });

  it('uses the unique exact driver name match before a mismatched phone match', async () => {
    const ambulance = { _id: new Types.ObjectId() };
    const nameQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([ambulance]),
    };
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(nameQuery),
      findOne: jest.fn(),
    };
    const emergencyRequestModel = {
      distinct: jest.fn().mockResolvedValue([]),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );
    const findDriverAmbulance = service as unknown as {
      findDriverAmbulance: (user: {
        fullName: string;
        phone: string;
      }) => Promise<AmbulanceDocument>;
    };

    await expect(
      findDriverAmbulance.findDriverAmbulance({
        fullName: 'Pooja Shrestha',
        phone: '+9779876543667',
      }),
    ).resolves.toBe(ambulance);
    expect(ambulanceModel.find).toHaveBeenCalledWith({
      driverName: /^Pooja Shrestha$/i,
      isActive: true,
    });
    expect(ambulanceModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects ambiguous exact driver name matches', async () => {
    const nameQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{}, {}]),
    };
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(nameQuery),
      findOne: jest.fn(),
    };
    const emergencyRequestModel = {
      distinct: jest.fn().mockResolvedValue([]),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );
    const findDriverAmbulance = service as unknown as {
      findDriverAmbulance: (user: {
        fullName: string;
        phone: string;
      }) => Promise<AmbulanceDocument>;
    };

    await expect(
      findDriverAmbulance.findDriverAmbulance({
        fullName: 'Pooja Shrestha',
        phone: '+9779876543667',
      }),
    ).rejects.toThrow('Driver ambulance assignment is ambiguous');
    expect(ambulanceModel.findOne).not.toHaveBeenCalled();
  });

  it('matches canonical user phones to ten-digit ambulance phones', async () => {
    const ambulance = { _id: new Types.ObjectId() };
    const ambulanceModel = {
      findOne: jest.fn().mockResolvedValue(ambulance),
    };
    const service = new EmergencyRequestService(
      {} as Model<EmergencyRequestDocument>,
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );
    const findDriverAmbulance = service as unknown as {
      findDriverAmbulance: (user: { phone: string }) => Promise<AmbulanceDocument>;
    };

    await expect(
      findDriverAmbulance.findDriverAmbulance({ phone: '+9779876543667' }),
    ).resolves.toBe(ambulance);
    expect(ambulanceModel.findOne).toHaveBeenCalledWith({
      phone: {
        $in: ['+9779876543667', '9876543667', '9779876543667'],
      },
      isActive: true,
    });
  });
});

describe('EmergencyRequestService driver trip status', () => {
  it('updates the request ID supplied by the driver trip page', async () => {
    const requestId = new Types.ObjectId();
    const user = {} as UserDocument;
    const request = {
      id: requestId.toString(),
    };
    const emergencyRequestModel = {
      findById: jest.fn().mockResolvedValue(request),
    };
    const service = new EmergencyRequestService(
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      {} as Model<AmbulanceDocument>,
      {} as Model<HospitalDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
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
