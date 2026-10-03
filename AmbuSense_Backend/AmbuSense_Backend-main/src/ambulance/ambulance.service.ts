import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ModuleRef } from '@nestjs/core';
import { Model, Types } from 'mongoose';

import { UpdateAmbulanceDto } from './dto/update-ambulance.dto';
import { CreateAmbulanceDto } from './dto/create-ambulance.dto';
import { UpdateAmbulanceStatusDto } from './dto/update-ambulance-status.dto';
import { Ambulance, AmbulanceDocument } from './entities/ambulance.entity';
import { AmbulanceStatus, UserRole } from '../constants/enums';
import { TrackingGateway } from '../gateway/tracking.gateway';
import { FindAmbulancesQueryDto } from './dto/find-ambulances-query.dto';
import type { UserDocument } from '../users/entities/user.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import { getNepalPhoneVariants } from '../users/phone.util';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from '../emergency-request/entities/emergency-request.entity';
import { EmergencyRequestStatus } from '../constants/enums';

const ACTIVE_DRIVER_TRIP_STATUSES = [
  EmergencyRequestStatus.ASSIGNED,
  EmergencyRequestStatus.EN_ROUTE,
  EmergencyRequestStatus.AT_PATIENT,
  EmergencyRequestStatus.TRANSPORTING,
  EmergencyRequestStatus.AT_HOSPITAL,
];

const ALLOWED_STATUS_TRANSITIONS: Record<AmbulanceStatus, AmbulanceStatus[]> = {
  [AmbulanceStatus.OFFLINE]: [AmbulanceStatus.AVAILABLE],
  [AmbulanceStatus.AVAILABLE]: [
    AmbulanceStatus.ASSIGNED,
    AmbulanceStatus.OFFLINE,
  ],
  [AmbulanceStatus.ASSIGNED]: [AmbulanceStatus.EN_ROUTE],
  [AmbulanceStatus.EN_ROUTE]: [AmbulanceStatus.AT_PATIENT],
  [AmbulanceStatus.AT_PATIENT]: [AmbulanceStatus.TRANSPORTING],
  [AmbulanceStatus.TRANSPORTING]: [AmbulanceStatus.AT_HOSPITAL],
  [AmbulanceStatus.AT_HOSPITAL]: [AmbulanceStatus.COMPLETED],
  [AmbulanceStatus.COMPLETED]: [
    AmbulanceStatus.AVAILABLE,
    AmbulanceStatus.OFFLINE,
  ],
};

@Injectable()
export class AmbulanceService implements OnModuleInit {
  private trackingGateway?: TrackingGateway;

  constructor(
    @InjectModel(Ambulance.name)
    private readonly ambulanceModel: Model<AmbulanceDocument>,
    @InjectModel(EmergencyRequest.name)
    private readonly emergencyRequestModel: Model<EmergencyRequestDocument>,
    private readonly moduleRef: ModuleRef,
    private readonly roleProfilesService: RoleProfilesService,
  ) {}

  onModuleInit() {
    this.trackingGateway = this.moduleRef.get(TrackingGateway, {
      strict: false,
    });
  }

  private emitAmbulanceUpdated(data: AmbulanceDocument) {
    this.trackingGateway?.emitAmbulanceUpdated(data);
  }

  private emitAmbulanceStatusUpdated(data: {
    id: string;
    status: string;
    assignedAt: Date | null;
    reachedPatientAt: Date | null;
    transportStartedAt: Date | null;
    reachedHospitalAt: Date | null;
    completedAt: Date | null;
    updatedAt: Date;
  }) {
    this.trackingGateway?.emitAmbulanceStatusUpdated(data);
  }

  async create(createAmbulanceDto: CreateAmbulanceDto) {
    const { coordinates, ...rest } = createAmbulanceDto;
    this.assertValidCoordinates(coordinates);

    if (
      await this.ambulanceModel.findOne({
        ambulanceCode: createAmbulanceDto.ambulanceCode,
      })
    ) {
      throw new BadRequestException('Ambulance with this code already exists');
    }
    const created = await this.ambulanceModel.create({
      ...rest,
      currentLocation: {
        type: 'Point',
        coordinates,
      },
    });

    this.emitAmbulanceUpdated(created);

    return created;
  }

  private assertValidCoordinates(coordinates: [number, number]) {
    const [longitude, latitude] = coordinates;
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new BadRequestException('Please select a valid location');
    }
  }

  async findAll(query: FindAmbulancesQueryDto = {}) {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    const isActive = this.parseBooleanQuery(query.isActive);

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (query.search) {
      const regex = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [
        { ambulanceCode: regex },
        { driverName: regex },
        { phone: regex },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.ambulanceModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.ambulanceModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string) {
    const ambulance = await this.ambulanceModel.findById(id);

    if (!ambulance) {
      throw new NotFoundException('Ambulance not found');
    }

    return ambulance;
  }

  async update(id: string, dto: UpdateAmbulanceDto) {
    const { coordinates, ...fields } = dto;
    const ambulance = await this.ambulanceModel.findById(id);

    if (!ambulance) {
      throw new NotFoundException('Ambulance not found');
    }

    for (const [field, value] of Object.entries(fields)) {
      if (value !== undefined) {
        ambulance.set(field, value);
      }
    }

    if (coordinates) {
      this.assertValidCoordinates(coordinates);
      ambulance.currentLocation = {
        type: 'Point',
        coordinates,
      };
      ambulance.locationUpdatedAt = null;
    }

    const updated = await ambulance.save();

    this.emitAmbulanceUpdated(updated);

    return updated;
  }

  async updateDriverLocation(
    id: string,
    coordinates: [number, number],
    locationUpdatedAt: Date,
  ) {
    this.assertValidCoordinates(coordinates);
    const ambulance = await this.ambulanceModel.findById(id);

    if (!ambulance) {
      throw new NotFoundException('Ambulance not found');
    }

    ambulance.currentLocation = { type: 'Point', coordinates };
    ambulance.locationUpdatedAt = locationUpdatedAt;
    return ambulance.save();
  }

  async updateStatus(
    id: string,
    dto: UpdateAmbulanceStatusDto,
    currentUser?: UserDocument,
  ) {
    if (currentUser?.role === UserRole.DRIVER) {
      await this.assertDriverCanAccessAmbulance(id, currentUser);
    }

    const ambulance = await this.ambulanceModel.findById(id);

    if (!ambulance) {
      throw new NotFoundException('Ambulance not found');
    }

    const currentStatus = ambulance.status;
    const nextStatus = dto.status;

    const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    const isAdminOverride = currentUser?.role === UserRole.ADMIN;
    if (!isAdminOverride && !allowedNextStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${nextStatus}'`,
      );
    }

    ambulance.status = nextStatus;

    if (nextStatus === AmbulanceStatus.ASSIGNED) {
      ambulance.assignedAt = new Date();
    }

    if (nextStatus === AmbulanceStatus.AT_PATIENT) {
      ambulance.reachedPatientAt = new Date();
    }

    if (nextStatus === AmbulanceStatus.TRANSPORTING) {
      ambulance.transportStartedAt = new Date();
    }

    if (nextStatus === AmbulanceStatus.AT_HOSPITAL) {
      ambulance.reachedHospitalAt = new Date();
    }

    if (nextStatus === AmbulanceStatus.COMPLETED) {
      ambulance.completedAt = new Date();
    }

    if (
      nextStatus === AmbulanceStatus.AVAILABLE ||
      nextStatus === AmbulanceStatus.OFFLINE
    ) {
      ambulance.assignedAt = null;
      ambulance.reachedPatientAt = null;
      ambulance.transportStartedAt = null;
      ambulance.reachedHospitalAt = null;
      ambulance.completedAt = null;
    }

    const updated = await ambulance.save();

    this.emitAmbulanceStatusUpdated({
      id: updated.id,
      status: updated.status,
      assignedAt: updated.assignedAt,
      reachedPatientAt: updated.reachedPatientAt,
      transportStartedAt: updated.transportStartedAt,
      reachedHospitalAt: updated.reachedHospitalAt,
      completedAt: updated.completedAt,
      updatedAt: updated.updatedAt || new Date(),
    });

    this.emitAmbulanceUpdated(updated);

    return updated;
  }

  /**
   * Force-sets ambulance status without checking allowed transitions.
   * Used internally (e.g., on driver disconnect) to safely mark as OFFLINE.
   */
  async updateStatusDirectly(
    ambulanceId: string,
    status: AmbulanceStatus,
  ): Promise<void> {
    await this.ambulanceModel.findByIdAndUpdate(ambulanceId, {
      $set: { status },
    });
  }

  async remove(id: string) {
    const deleted = await this.ambulanceModel.findByIdAndDelete(id);

    if (!deleted) {
      throw new NotFoundException('Ambulance not found');
    }

    return { message: 'Ambulance deleted successfully' };
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private parseBooleanQuery(value: boolean | string | undefined) {
    if (value === undefined) {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return undefined;
  }

  async findDriverAmbulance(user: UserDocument): Promise<AmbulanceDocument> {
    const activeTrips = await this.emergencyRequestModel
      .find({
        assignedDriverId: user._id,
        status: { $in: ACTIVE_DRIVER_TRIP_STATUSES },
      })
      .select('assignedAmbulance')
      .limit(2)
      .exec();

    if (activeTrips.length > 1) {
      throw new ConflictException(
        'Driver has more than one active trip assignment',
      );
    }

    if (activeTrips.length === 1) {
      const ambulanceId = activeTrips[0].assignedAmbulance;
      if (!ambulanceId) {
        throw new NotFoundException('Driver ambulance not found');
      }

      const assignedAmbulance = await this.ambulanceModel.findById(ambulanceId);
      if (!assignedAmbulance || !assignedAmbulance.isActive) {
        throw new NotFoundException('Driver ambulance not found');
      }

      return assignedAmbulance;
    }

    const ambulances = await this.ambulanceModel
      .find({
        phone: { $in: getNepalPhoneVariants(user.phone) },
        isActive: true,
        status: { $ne: AmbulanceStatus.COMPLETED },
      })
      .limit(2)
      .exec();

    if (ambulances.length > 1) {
      throw new ConflictException(
        'Driver phone is linked to multiple active ambulances',
      );
    }

    if (ambulances.length === 0) {
      throw new NotFoundException('Driver ambulance not found');
    }

    return ambulances[0];
  }

  private async assertDriverCanAccessAmbulance(
    ambulanceId: string,
    user: UserDocument,
  ) {
    await this.roleProfilesService.assertDriverVerified(
      user._id as Types.ObjectId,
    );

    const ambulance = await this.findDriverAmbulance(user);

    if (ambulance._id.toString() !== ambulanceId) {
      throw new NotFoundException('Ambulance not found');
    }
  }
}
