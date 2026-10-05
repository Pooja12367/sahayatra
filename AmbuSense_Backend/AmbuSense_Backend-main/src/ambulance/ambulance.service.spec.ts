import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { ModuleRef } from '@nestjs/core';
import { AmbulanceStatus, UserRole } from '../constants/enums';
import { AmbulanceService } from './ambulance.service';
import { AmbulanceDocument } from './entities/ambulance.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import type { EmergencyRequestDocument } from '../emergency-request/entities/emergency-request.entity';
import type { UserDocument } from '../users/entities/user.entity';

describe('AmbulanceService.update', () => {
  it('saves the supplied GeoJSON coordinates without clearing omitted fields', async () => {
    const savedDocument = {
      ambulanceCode: 'AMB-102',
      driverName: 'Test Driver',
      phone: '9817404665',
      status: 'assigned',
      locationName: 'Old place',
      currentLocation: {
        type: 'Point',
        coordinates: [85.324, 27.7172],
      },
      locationUpdatedAt: null,
      set(field: string, value: unknown) {
        Object.assign(this, { [field]: value });
      },
      async save() {
        if (!this.status) {
          throw new Error('Required status was cleared');
        }
        return this;
      },
    };
    const ambulanceModel = {
      findById: jest.fn().mockResolvedValue(savedDocument),
    } as unknown as Model<AmbulanceDocument>;
    const service = new AmbulanceService(
      ambulanceModel,
      {} as Model<EmergencyRequestDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );

    const updated = await service.update('ambulance-id', {
      status: undefined,
      ambulanceCode: undefined,
      coordinates: [85.4123, 27.8123],
      locationName: 'New place',
    });

    expect(savedDocument.status).toBe('assigned');
    expect(savedDocument.locationName).toBe('New place');
    expect(savedDocument.currentLocation).toEqual({
      type: 'Point',
      coordinates: [85.4123, 27.8123],
    });
    expect(updated.currentLocation.coordinates).toEqual([85.4123, 27.8123]);
    expect(updated.locationUpdatedAt).toBeNull();
  });

  it('preserves availability when an administrator links the verified driver', async () => {
    const driverId = new Types.ObjectId();
    const ambulanceId = new Types.ObjectId();
    const ambulance = {
      _id: ambulanceId,
      driverId: new Types.ObjectId(),
      driverName: 'Previous Driver',
      phone: '9811111111',
      status: 'available',
      set(field: string, value: unknown) {
        Object.assign(this, { [field]: value });
      },
      async save() {
        return this;
      },
    };
    const ambulanceModel = {
      findById: jest.fn().mockResolvedValue(ambulance),
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    } as unknown as Model<AmbulanceDocument>;
    const roleProfilesService = {
      getVerifiedDriverUser: jest.fn().mockResolvedValue({
        _id: driverId,
        fullName: 'Verified Driver',
        phone: '+9779812345678',
      }),
    } as unknown as RoleProfilesService;
    const service = new AmbulanceService(
      ambulanceModel,
      {} as Model<EmergencyRequestDocument>,
      {} as ModuleRef,
      roleProfilesService,
    );

    await service.update(ambulanceId.toString(), {
      driverId: driverId.toString(),
    });

    expect(ambulance.driverId).toBe(driverId);
    expect(ambulance.status).toBe('available');
  });
});

describe('AmbulanceService.updateStatus', () => {
  it('returns the status saved to the ambulance document', async () => {
    const ambulance = {
      id: 'ambulance-id',
      status: 'offline',
      assignedAt: null,
      reachedPatientAt: null,
      transportStartedAt: null,
      reachedHospitalAt: null,
      completedAt: null,
      updatedAt: new Date('2026-10-05T00:00:00.000Z'),
      save: jest.fn(async function (this: { status: string }) {
        return this;
      }),
    };
    const ambulanceModel = {
      findById: jest.fn().mockResolvedValue(ambulance),
    } as unknown as Model<AmbulanceDocument>;
    const service = new AmbulanceService(
      ambulanceModel,
      {} as Model<EmergencyRequestDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );

    const saved = await service.updateStatus(
      'ambulance-id',
      { status: AmbulanceStatus.AVAILABLE },
      { role: UserRole.ADMIN } as UserDocument,
    );

    expect(ambulance.save).toHaveBeenCalled();
    expect(saved.status).toBe('available');
  });
});

describe('AmbulanceService.create', () => {
  it('persists the selected verified driver ID on the ambulance', async () => {
    const driverId = new Types.ObjectId();
    const created = {
      id: 'ambulance-id',
      driverId,
      driverName: 'Verified Driver',
      phone: '9812345678',
    };
    const noExistingAmbulanceQuery = {
      exec: jest.fn().mockResolvedValue(null),
      then: (resolve: (value: null) => unknown) =>
        Promise.resolve(null).then(resolve),
    };
    const ambulanceModel = {
      findOne: jest.fn().mockReturnValue(noExistingAmbulanceQuery),
      create: jest.fn().mockResolvedValue(created),
    } as unknown as Model<AmbulanceDocument>;
    const roleProfilesService = {
      getVerifiedDriverUser: jest.fn().mockResolvedValue({
        _id: driverId,
        fullName: 'Verified Driver',
        phone: '+9779812345678',
      }),
    } as unknown as RoleProfilesService;
    const service = new AmbulanceService(
      ambulanceModel,
      {} as Model<EmergencyRequestDocument>,
      {} as ModuleRef,
      roleProfilesService,
    );

    await service.create({
      ambulanceCode: 'AMB-102',
      driverId: driverId.toString(),
      coordinates: [85.324, 27.7172],
    });

    expect(roleProfilesService.getVerifiedDriverUser).toHaveBeenCalledWith(
      driverId.toString(),
    );
    expect(ambulanceModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        driverId,
        driverName: 'Verified Driver',
        phone: '9812345678',
      }),
    );
  });

  it('allows an unassigned ambulance without driver identity fields', async () => {
    const ambulanceModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
        then: (resolve: (value: null) => unknown) =>
          Promise.resolve(null).then(resolve),
      }),
      create: jest.fn().mockResolvedValue({ id: 'ambulance-id' }),
    } as unknown as Model<AmbulanceDocument>;
    const service = new AmbulanceService(
      ambulanceModel,
      {} as Model<EmergencyRequestDocument>,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );

    await service.create({
      ambulanceCode: 'AMB-103',
      coordinates: [85.324, 27.7172],
    });

    const createPayload = (ambulanceModel.create as jest.Mock).mock.calls[0][0];
    expect(createPayload).not.toHaveProperty('driverId');
    expect(createPayload).not.toHaveProperty('driverName');
    expect(createPayload).not.toHaveProperty('phone');
  });
});

describe('AmbulanceService.findDriverAmbulance', () => {
  it('loads the ambulance from the authenticated driver active assignment ID', async () => {
    const ambulance = { _id: 'ambulance-764' };
    const tripQuery = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ assignedAmbulance: ambulance._id }]),
    };
    const emergencyRequestModel = {
      find: jest.fn().mockReturnValue(tripQuery),
    } as unknown as Model<EmergencyRequestDocument>;
    const ambulanceModel = {
      findById: jest.fn().mockResolvedValue(ambulance),
      find: jest.fn(),
    } as unknown as Model<AmbulanceDocument>;
    const service = new AmbulanceService(
      ambulanceModel,
      emergencyRequestModel,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );

    await expect(
      service.findDriverAmbulance({
        fullName: 'Pooja Shrestha',
        phone: '+9779876543667',
      } as UserDocument),
    ).resolves.toBe(ambulance);
    expect(emergencyRequestModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedDriverId: expect.any(Object),
        status: { $in: expect.any(Array) },
      }),
    );
    expect(ambulanceModel.findById).toHaveBeenCalledWith(ambulance._id);
    expect(ambulanceModel.find).not.toHaveBeenCalled();
  });

  it('loads a linked ambulance by the authenticated user ID', async () => {
    const driverId = new Types.ObjectId();
    const ambulance = { _id: new Types.ObjectId(), driverId };
    const tripQuery = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const linkedAmbulanceQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([ambulance]),
    };
    const emergencyRequestModel = {
      find: jest.fn().mockReturnValue(tripQuery),
    } as unknown as Model<EmergencyRequestDocument>;
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(linkedAmbulanceQuery),
    } as unknown as Model<AmbulanceDocument>;
    const service = new AmbulanceService(
      ambulanceModel,
      emergencyRequestModel,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );

    await expect(
      service.findDriverAmbulance({
        _id: driverId,
        phone: '9812345678',
      } as UserDocument),
    ).resolves.toBe(ambulance);
    expect(ambulanceModel.find).toHaveBeenCalledWith({
      driverId,
      isActive: true,
    });
  });

  it('finds the linked completed ambulance so the driver can reset availability', async () => {
    const ambulance = { _id: 'ambulance-764', status: 'completed' };
    const tripQuery = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const byDriverIdQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const availableAmbulanceQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const completedAmbulanceQuery = {
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([ambulance]),
    };
    const emergencyRequestModel = {
      find: jest.fn().mockReturnValue(tripQuery),
    } as unknown as Model<EmergencyRequestDocument>;
    const ambulanceModel = {
      find: jest
        .fn()
        .mockReturnValueOnce(byDriverIdQuery)
        .mockReturnValueOnce(availableAmbulanceQuery)
        .mockReturnValueOnce(completedAmbulanceQuery),
    } as unknown as Model<AmbulanceDocument>;
    const service = new AmbulanceService(
      ambulanceModel,
      emergencyRequestModel,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );

    await expect(
      service.findDriverAmbulance({
        fullName: 'Pooja Shrestha',
        phone: '+9779876543667',
      } as UserDocument),
    ).resolves.toBe(ambulance);
    expect(ambulanceModel.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        phone: { $in: expect.arrayContaining(['9876543667']) },
        isActive: true,
        status: { $ne: 'completed' },
      }),
    );
    expect(ambulanceModel.find).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        phone: { $in: expect.arrayContaining(['9876543667']) },
        isActive: true,
        status: 'completed',
      }),
    );
  });

  it('rejects multiple active assignments for the authenticated driver', async () => {
    const tripQuery = {
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{}, {}]),
    };
    const emergencyRequestModel = {
      find: jest.fn().mockReturnValue(tripQuery),
    } as unknown as Model<EmergencyRequestDocument>;
    const ambulanceModel = {
      find: jest.fn(),
    } as unknown as Model<AmbulanceDocument>;
    const service = new AmbulanceService(
      ambulanceModel,
      emergencyRequestModel,
      {} as ModuleRef,
      {} as RoleProfilesService,
    );

    await expect(
      service.findDriverAmbulance({
        fullName: 'Pooja Shrestha',
        phone: '+9779876543667',
      } as UserDocument),
    ).rejects.toThrow('Driver has more than one active trip assignment');
    expect(ambulanceModel.find).not.toHaveBeenCalled();
  });
});
