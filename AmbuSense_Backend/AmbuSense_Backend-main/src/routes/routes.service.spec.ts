import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { AmbulanceDocument } from '../ambulance/entities/ambulance.entity';
import { EmergencyRequestDocument } from '../emergency-request/entities/emergency-request.entity';
import { HospitalDocument } from '../hospital/entities/hospital.entity';
import { UserRole } from '../constants/enums';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import type { UserDocument } from '../users/entities/user.entity';
import { RoutesService } from './routes.service';

describe('RoutesService full trip route', () => {
  const requestId = new Types.ObjectId();
  const ambulanceId = new Types.ObjectId();
  const driverId = new Types.ObjectId();
  const hospitalId = new Types.ObjectId();
  const ambulanceCoordinates: [number, number] = [83.471228, 27.689479];
  const pickupCoordinates: [number, number] = [83.478431, 27.686656];
  const hospitalCoordinates: [number, number] = [83.469453, 27.69283];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeService() {
    const request = {
      assignedAmbulance: ambulanceId,
      assignedDriverId: driverId,
      assignedHospital: hospitalId,
      pickupLocation: {
        type: 'Point',
        coordinates: pickupCoordinates,
      },
    };
    const ambulance = {
      _id: ambulanceId,
      currentLocation: {
        type: 'Point',
        coordinates: ambulanceCoordinates,
      },
      ambulanceCode: '44444',
    };
    const hospital = {
      _id: hospitalId,
      name: '666',
      location: {
        type: 'Point',
        coordinates: hospitalCoordinates,
      },
    };
    const emergencyRequestModel = {
      findById: jest.fn().mockResolvedValue(request),
    };
    const ambulanceModel = {
      findById: jest.fn().mockResolvedValue(ambulance),
      find: jest.fn().mockResolvedValue([ambulance, { ambulanceCode: '890' }]),
    };
    const hospitalModel = {
      findById: jest.fn().mockResolvedValue(hospital),
    };
    const roleProfilesService = {
      assertDriverVerified: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoutesService(
      ambulanceModel as unknown as Model<AmbulanceDocument>,
      emergencyRequestModel as unknown as Model<EmergencyRequestDocument>,
      hospitalModel as unknown as Model<HospitalDocument>,
      {
        get: jest.fn().mockReturnValue('https://router.test'),
      } as unknown as ConfigService,
      roleProfilesService as unknown as RoleProfilesService,
    );

    return {
      ambulanceModel,
      emergencyRequestModel,
      hospitalModel,
      service,
    };
  }

  it('routes using the request ambulance ID even when driver names are duplicated', async () => {
    const { service, ambulanceModel, hospitalModel } = makeService();
    const user = {
      _id: driverId,
      fullName: 'Shared Driver Name',
      role: UserRole.DRIVER,
    } as UserDocument;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 'Ok',
          routes: [
            {
              distance: 1000,
              duration: 300,
              geometry: { type: 'LineString', coordinates: [] },
            },
          ],
        }),
    } as Response);

    const result: unknown = await service.getFullRequestRoute(
      requestId.toString(),
      user,
    );

    expect(result).toMatchObject({
      totalDistance: 2000,
      totalDuration: 600,
    });
    const firstCall = fetchMock.mock.calls[0];
    const secondCall = fetchMock.mock.calls[1];
    expect(firstCall?.[0]).toBe(
      'https://router.test/route/v1/driving/83.471228,27.689479;83.478431,27.686656?overview=full&geometries=geojson',
    );
    expect(firstCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(secondCall?.[0]).toBe(
      'https://router.test/route/v1/driving/83.478431,27.686656;83.469453,27.69283?overview=full&geometries=geojson',
    );
    expect(secondCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(ambulanceModel.findById).toHaveBeenCalledWith(
      ambulanceId.toString(),
    );
    expect(ambulanceModel.find).not.toHaveBeenCalled();
    expect(hospitalModel.findById).toHaveBeenCalledWith(hospitalId);
  });

  it('reports invalid hospital coordinates independently from assignment access', async () => {
    const { service, hospitalModel } = makeService();
    hospitalModel.findById.mockResolvedValue({
      _id: hospitalId,
      name: '666',
      location: { type: 'Point', coordinates: [NaN, 27.69283] },
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(
      service.getFullRequestRoute(requestId.toString(), {
        _id: driverId,
        role: UserRole.DRIVER,
      } as UserDocument),
    ).rejects.toThrow(
      new BadRequestException(
        'Route locations must contain valid longitude and latitude coordinates',
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
