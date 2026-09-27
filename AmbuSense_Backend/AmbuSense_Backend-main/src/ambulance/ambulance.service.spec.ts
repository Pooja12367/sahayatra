import type { Model } from 'mongoose';
import { ModuleRef } from '@nestjs/core';
import { AmbulanceService } from './ambulance.service';
import { AmbulanceDocument, Ambulance } from './entities/ambulance.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';

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
  });
});