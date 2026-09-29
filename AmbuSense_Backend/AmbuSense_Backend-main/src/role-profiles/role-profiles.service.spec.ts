import type { Model } from 'mongoose';
import { UserRole } from '../constants/enums';
import { UsersService } from '../users/users.service';
import { Ambulance, AmbulanceDocument } from '../ambulance/entities/ambulance.entity';
import { Driver, DriverDocument } from './entities/driver.entity';
import { Admin, AdminDocument } from './entities/admin.entity';
import { Dispatcher, DispatcherDocument } from './entities/dispatcher.entity';
import { Patient, PatientDocument } from './entities/patient.entity';
import { RoleProfilesService } from './role-profiles.service';

describe('RoleProfilesService.findDrivers', () => {
  it('skips driver profiles whose populated user record is missing', async () => {
    const populatedProfile = {
      _id: { toString: () => 'driver-profile-1' },
      user: {
        _id: { toString: () => 'user-1' },
        fullName: 'Driver One',
        email: 'driver@example.com',
        phone: '9817404665',
        role: UserRole.DRIVER,
        isActive: true,
      },
      documentType: null,
      documentImageId: null,
      isVerified: false,
      verificationNote: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const profileQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        populatedProfile,
        { ...populatedProfile, _id: { toString: () => 'orphan' }, user: null },
      ]),
    };
    const ambulanceQuery = {
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const driverModel = {
      find: jest.fn().mockReturnValue(profileQuery),
      countDocuments: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      }),
    } as unknown as Model<DriverDocument>;
    const ambulanceModel = {
      find: jest.fn().mockReturnValue(ambulanceQuery),
    } as unknown as Model<AmbulanceDocument>;
    const service = new RoleProfilesService(
      {} as Model<AdminDocument>,
      {} as Model<DispatcherDocument>,
      driverModel,
      {} as Model<PatientDocument>,
      ambulanceModel,
      {} as UsersService,
    );

    const result = await service.findDrivers({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'driver-profile-1',
      user: { fullName: 'Driver One' },
    });
    expect(result.meta.total).toBe(2);
  });
});