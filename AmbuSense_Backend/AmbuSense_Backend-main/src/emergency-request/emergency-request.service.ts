import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ModuleRef } from '@nestjs/core';
import { isValidObjectId, Model, Types } from 'mongoose';
import { CreateEmergencyRequestDto } from './dto/create-emergency-request.dto';
import { UpdateEmergencyRequestDto } from './dto/update-emergency-request.dto';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from './entities/emergency-request.entity';
import {
  Ambulance,
  AmbulanceDocument,
} from '../ambulance/entities/ambulance.entity';
import {
  AmbulanceStatus,
  EmergencyRequestStatus,
  HospitalAssignmentTechnique,
  UserRole,
} from '../constants/enums';
import { AssignEmergencyRequestDto } from './dto/assign-emergency-request.dto';
import {
  Hospital,
  HospitalDocument,
} from '../hospital/entities/hospital.entity';
import { DispatchEmergencyRequestDto } from './dto/dispatch-emergency-request.dto';
import { CancelEmergencyRequestDto } from './dto/cancel-emergency-request.dto';
import { FindEmergencyRequestsQueryDto } from './dto/find-emergency-requests-query.dto';
import { TrackingGateway } from '../gateway/tracking.gateway';
import { UserDocument } from '../users/entities/user.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';

@Injectable()
export class EmergencyRequestService implements OnModuleInit {
  private trackingGateway?: TrackingGateway;

  private readonly ALLOWED_STATUS_TRANSITIONS: Record<
    EmergencyRequestStatus,
    EmergencyRequestStatus[]
  > = {
    [EmergencyRequestStatus.PENDING]: [EmergencyRequestStatus.ASSIGNED],
    [EmergencyRequestStatus.ASSIGNED]: [EmergencyRequestStatus.EN_ROUTE],
    [EmergencyRequestStatus.EN_ROUTE]: [EmergencyRequestStatus.AT_PATIENT],
    [EmergencyRequestStatus.AT_PATIENT]: [EmergencyRequestStatus.TRANSPORTING],
    [EmergencyRequestStatus.TRANSPORTING]: [EmergencyRequestStatus.AT_HOSPITAL],
    [EmergencyRequestStatus.AT_HOSPITAL]: [EmergencyRequestStatus.COMPLETED],
    [EmergencyRequestStatus.COMPLETED]: [EmergencyRequestStatus.PENDING],
    [EmergencyRequestStatus.CANCELLED]: [],
  };

  constructor(
    @InjectModel(EmergencyRequest.name)
    private readonly emergencyRequestModel: Model<EmergencyRequestDocument>,
    @InjectModel(Ambulance.name)
    private readonly ambulanceModel: Model<AmbulanceDocument>,
    @InjectModel(Hospital.name)
    private readonly hospitalModel: Model<HospitalDocument>,
    private readonly moduleRef: ModuleRef,
    private readonly roleProfilesService: RoleProfilesService,
  ) {}

  onModuleInit() {
    this.trackingGateway = this.moduleRef.get(TrackingGateway, {
      strict: false,
    });
  }

  private emitEmergencyRequestCreated(data: EmergencyRequestDocument) {
    this.trackingGateway?.emitEmergencyRequestCreated(data);
  }

  private emitEmergencyRequestUpdated(data: EmergencyRequestDocument) {
    this.trackingGateway?.emitEmergencyRequestUpdated(data);
  }

  private emitEmergencyRequestDispatched(data: EmergencyRequestDocument) {
    this.trackingGateway?.emitEmergencyRequestDispatched(data);
  }

  private emitEmergencyRequestCancelled(data: EmergencyRequestDocument) {
    this.trackingGateway?.emitEmergencyRequestCancelled(data);
  }

  private emitEmergencyRequestDeleted(id: string) {
    this.trackingGateway?.emitEmergencyRequestDeleted({ id });
  }

  async create(
    createDto: CreateEmergencyRequestDto,
    currentUser?: UserDocument,
  ) {
    const { coordinates, assignedHospital, ...rest } = createDto;

    const requestData: Partial<EmergencyRequest> & {
      pickupLocation: { type: 'Point'; coordinates: [number, number] };
    } = {
      ...rest,
      pickupLocation: {
        type: 'Point',
        coordinates,
      },
      status: EmergencyRequestStatus.PENDING,
      assignedAmbulance: null,
      assignedHospital: null,
      hospitalBedReserved: false,
      assignedAt: null,
      reachedPatientAt: null,
      completedAt: null,
      cancelledAt: null,
      cancellationReason: '',
    };

    if (currentUser?.role === UserRole.PATIENT) {
      requestData.patient = currentUser._id as Types.ObjectId;
    }

    if (assignedHospital) {
      const hospital = await this.findValidHospitalById(assignedHospital);
      requestData.assignedHospital = hospital._id as Types.ObjectId;
      requestData.hospitalAssignmentTechnique =
        HospitalAssignmentTechnique.USER_CHOICE;
    }

    const assignedAt = new Date();
    const nearestAmbulance = await this.claimNearestAvailableAmbulance(
      coordinates,
      assignedAt,
    );

    if (nearestAmbulance) {
      requestData.assignedAmbulance = nearestAmbulance._id as Types.ObjectId;
      requestData.status = EmergencyRequestStatus.ASSIGNED;
      requestData.assignedAt = assignedAt;

      if (!requestData.assignedHospital) {
        const nearestHospital =
          await this.findNearestValidHospital(coordinates);

        if (!nearestHospital) {
          await this.releaseAmbulance(nearestAmbulance._id as Types.ObjectId);
          throw new NotFoundException('No available hospital found');
        }

        requestData.assignedHospital = nearestHospital._id as Types.ObjectId;
        requestData.hospitalAssignmentTechnique =
          HospitalAssignmentTechnique.SYSTEM_AUTO;
      }

      if (requestData.assignedHospital) {
        const reserved = await this.reserveHospitalBed(
          requestData.assignedHospital,
        );

        if (!reserved) {
          await this.releaseAmbulance(nearestAmbulance._id as Types.ObjectId);
          throw new BadRequestException('No available hospital beds found');
        }

        requestData.hospitalBedReserved = true;
      }
    }

    const created = await this.emergencyRequestModel.create(requestData);

    const result = await this.findOne(created.id);
    this.emitEmergencyRequestCreated(result);

    if (result.status === EmergencyRequestStatus.ASSIGNED) {
      this.emitEmergencyRequestDispatched(result);
    }

    return result;
  }

  async findAll(
    query: FindEmergencyRequestsQueryDto = {},
    currentUser?: UserDocument,
  ) {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.assignedAmbulance) {
      filter.assignedAmbulance = new Types.ObjectId(query.assignedAmbulance);
    }

    if (currentUser?.role === UserRole.DRIVER) {
      await this.assertDriverVerified(currentUser);
      const ambulance = await this.findDriverAmbulance(currentUser);
      filter.assignedAmbulance = ambulance._id;
    }

    if (query.assignedHospital) {
      filter.assignedHospital = new Types.ObjectId(query.assignedHospital);
    }

    if (query.hospitalAssignmentTechnique) {
      filter.hospitalAssignmentTechnique = query.hospitalAssignmentTechnique;
    }

    if (query.search) {
      const regex = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [
        { patientName: regex },
        { patientPhone: regex },
        { notes: regex },
        { cancellationReason: regex },
      ];
    }

    return this.emergencyRequestModel
      .find(filter)
      .populate('assignedAmbulance')
      .populate('assignedHospital')
      .sort({ createdAt: -1 });
  }

  async findOne(id: string, currentUser?: UserDocument) {
    const request = await this.emergencyRequestModel
      .findById(id)
      .populate('assignedAmbulance')
      .populate('assignedHospital');

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    await this.assertCanAccessRequest(request, currentUser);

    return request;
  }

  async update(id: string, dto: UpdateEmergencyRequestDto) {
    const request = await this.emergencyRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    if (dto.patientName !== undefined) {
      request.patientName = dto.patientName;
    }

    if (dto.patientPhone !== undefined) {
      request.patientPhone = dto.patientPhone;
    }

    if (dto.coordinates) {
      request.pickupLocation = {
        type: 'Point',
        coordinates: dto.coordinates,
      };
    }

    const previousHospital = request.assignedHospital;
    const previousBedReserved = request.hospitalBedReserved;

    if (dto.assignedHospital !== undefined) {
      const hospital = await this.findValidHospitalById(dto.assignedHospital);
      request.assignedHospital = hospital._id as Types.ObjectId;
      request.hospitalAssignmentTechnique =
        HospitalAssignmentTechnique.USER_CHOICE;
    }

    const hospitalChanged =
      previousHospital &&
      request.assignedHospital &&
      previousHospital.toString() !== request.assignedHospital.toString();

    if (
      request.assignedHospital &&
      this.shouldReserveBedForRequest(request) &&
      (!request.hospitalBedReserved || hospitalChanged)
    ) {
      const reserved = await this.reserveHospitalBed(request.assignedHospital);

      if (!reserved) {
        throw new BadRequestException('No available hospital beds found');
      }

      request.hospitalBedReserved = true;
    }

    if (previousBedReserved && hospitalChanged) {
      await this.releaseHospitalBed(previousHospital);
    }

    if (dto.notes !== undefined) {
      request.notes = dto.notes;
    }

    const updated = await request.save();

    const result = await this.findOne(updated.id);
    this.emitEmergencyRequestUpdated(result);

    return result;
  }

  async dispatch(id: string, dto: DispatchEmergencyRequestDto) {
    const request = await this.emergencyRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    this.assertRequestNotDispatched(request);

    const hospital = await this.resolveHospitalForDispatch(
      dto,
      request.pickupLocation.coordinates,
    );

    const assignedAt = new Date();
    const ambulance = dto.ambulanceId
      ? await this.claimAvailableAmbulanceById(dto.ambulanceId, assignedAt)
      : await this.claimNearestAvailableAmbulance(
          request.pickupLocation.coordinates,
          assignedAt,
        );

    if (!ambulance) {
      throw new NotFoundException('No available ambulance found');
    }

    request.assignedAmbulance = ambulance._id as Types.ObjectId;
    request.assignedHospital = hospital._id as Types.ObjectId;
    request.hospitalAssignmentTechnique = dto.hospitalAssignmentTechnique;
    request.status = EmergencyRequestStatus.ASSIGNED;
    request.assignedAt = assignedAt;

    const reserved = await this.reserveHospitalBed(hospital._id as Types.ObjectId);

    if (!reserved) {
      await this.releaseAmbulance(ambulance._id as Types.ObjectId);
      throw new BadRequestException('No available hospital beds found');
    }

    request.hospitalBedReserved = true;

    if (dto.notes !== undefined) {
      request.notes = dto.notes;
    }

    await request.save();

    const result = await this.findOne(request.id);
    this.emitEmergencyRequestDispatched(result);

    return result;
  }

  async cancel(
    id: string,
    dto: CancelEmergencyRequestDto,
    currentUser?: UserDocument,
  ) {
    const request = await this.emergencyRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    await this.assertCanCancelRequest(request, currentUser);

    return this.cancelRequestDocument(request, dto);
  }

  private async cancelRequestDocument(
    request: EmergencyRequestDocument,
    dto: CancelEmergencyRequestDto,
  ) {
    if (request.status === EmergencyRequestStatus.CANCELLED) {
      throw new BadRequestException('Emergency request is already cancelled');
    }

    if (request.status === EmergencyRequestStatus.COMPLETED) {
      throw new BadRequestException(
        'Completed emergency request cannot be cancelled',
      );
    }

    if (request.assignedAmbulance) {
      await this.releaseAmbulance(request.assignedAmbulance);
    }

    if (this.shouldReleaseReservedBedOnCancellation(request)) {
      await this.releaseHospitalBed(request.assignedHospital);
      request.hospitalBedReserved = false;
    }

    request.status = EmergencyRequestStatus.CANCELLED;
    request.cancelledAt = new Date();

    if (dto.reason !== undefined) {
      request.cancellationReason = dto.reason;
    }

    await request.save();

    const result = await this.findOne(request.id);
    this.emitEmergencyRequestCancelled(result);

    return result;
  }

  async assign(id: string, dto: AssignEmergencyRequestDto) {
    const request = await this.emergencyRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    let ambulance: AmbulanceDocument | null = null;

    if (dto.ambulanceId) {
      if (!isValidObjectId(dto.ambulanceId)) {
        throw new BadRequestException('Invalid ambulance id');
      }

      ambulance = await this.claimAvailableAmbulanceById(
        dto.ambulanceId,
        new Date(),
      );
    } else {
      ambulance = await this.claimNearestAvailableAmbulance(
        request.pickupLocation.coordinates,
        new Date(),
      );

      if (!ambulance) {
        throw new NotFoundException('No available ambulance found');
      }
    }

    if (request.assignedAmbulance) {
      const previousAmbulance = await this.ambulanceModel.findById(
        request.assignedAmbulance,
      );

      if (previousAmbulance && previousAmbulance.id !== ambulance.id) {
        await this.releaseAmbulance(previousAmbulance._id as Types.ObjectId);
      }
    }

    const assignedAt = ambulance.assignedAt ?? new Date();

    request.assignedAmbulance = ambulance._id as Types.ObjectId;
    request.status = EmergencyRequestStatus.ASSIGNED;
    request.assignedAt = assignedAt;

    const previousHospital = request.assignedHospital;
    const previousBedReserved = request.hospitalBedReserved;

    if (dto.hospitalId !== undefined) {
      const hospital = await this.findValidHospitalById(dto.hospitalId);
      request.assignedHospital = hospital._id as Types.ObjectId;
      request.hospitalAssignmentTechnique =
        HospitalAssignmentTechnique.USER_CHOICE;
    }

    const hospitalChanged =
      previousHospital &&
      request.assignedHospital &&
      previousHospital.toString() !== request.assignedHospital.toString();

    if (
      request.assignedHospital &&
      (!request.hospitalBedReserved || hospitalChanged)
    ) {
      const reserved = await this.reserveHospitalBed(request.assignedHospital);

      if (!reserved) {
        await this.releaseAmbulance(ambulance._id as Types.ObjectId);
        throw new BadRequestException('No available hospital beds found');
      }

      request.hospitalBedReserved = true;
    }

    if (previousBedReserved && hospitalChanged) {
      await this.releaseHospitalBed(previousHospital);
    }

    if (dto.notes !== undefined) {
      request.notes = dto.notes;
    }

    await request.save();

    const result = await this.findOne(request.id);
    this.emitEmergencyRequestDispatched(result);

    return result;
  }

  async updateStatus(
    id: string,
    newStatus: EmergencyRequestStatus,
    currentUser?: UserDocument,
  ) {
    const request = await this.emergencyRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    await this.assertCanUpdateStatus(request, currentUser);

    const currentStatus = request.status;
    const allowedNext = this.ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedNext.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
      );
    }

    request.status = newStatus;

    if (newStatus === EmergencyRequestStatus.ASSIGNED) {
      request.assignedAt = new Date();
    }

    if (newStatus === EmergencyRequestStatus.AT_PATIENT) {
      request.reachedPatientAt = new Date();
    }

    if (newStatus === EmergencyRequestStatus.COMPLETED) {
      request.completedAt = new Date();
    }

    await this.syncAssignedAmbulanceStatus(request, newStatus);

    await request.save();

    const result = await this.findOne(request.id);
    this.emitEmergencyRequestUpdated(result);

    return result;
  }

  async remove(id: string) {
    const request = await this.emergencyRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    if (request.assignedAmbulance) {
      const ambulance = await this.ambulanceModel.findById(
        request.assignedAmbulance,
      );

      if (ambulance) {
        await this.releaseAmbulance(ambulance._id as Types.ObjectId);
      }
    }

    if (this.shouldReleaseReservedBedOnCancellation(request)) {
      await this.releaseHospitalBed(request.assignedHospital);
    }

    await this.emergencyRequestModel.findByIdAndDelete(id);
    this.emitEmergencyRequestDeleted(id);

    return { message: 'Emergency request deleted successfully' };
  }

  async findMyRequests(user: UserDocument) {
    return this.emergencyRequestModel
      .find({ patient: user._id })
      .populate('assignedAmbulance')
      .populate('assignedHospital')
      .sort({ createdAt: -1 });
  }

  async findMyRequest(id: string, user: UserDocument) {
    const request = await this.findPatientOwnedRequest(id, user);
    return this.populateRequest(request);
  }

  async cancelMyRequest(
    id: string,
    dto: CancelEmergencyRequestDto,
    user: UserDocument,
  ) {
    const request = await this.findPatientOwnedRequest(id, user);
    return this.cancelRequestDocument(request, dto);
  }

  async findMyTrip(user: UserDocument) {
    await this.assertDriverVerified(user);

    const ambulance = await this.findDriverAmbulance(user);
    const request = await this.emergencyRequestModel
      .findOne({
        assignedAmbulance: ambulance._id,
        status: {
          $nin: [
            EmergencyRequestStatus.COMPLETED,
            EmergencyRequestStatus.CANCELLED,
          ],
        },
      })
      .populate('assignedAmbulance')
      .populate('assignedHospital')
      .sort({ assignedAt: -1, createdAt: -1 });

    if (!request) {
      throw new NotFoundException('Assigned trip not found');
    }

    return request;
  }

  async updateMyTripStatus(
    user: UserDocument,
    newStatus: EmergencyRequestStatus,
  ) {
    const trip = await this.findMyTrip(user);
    return this.updateStatus(trip.id, newStatus, user);
  }

  async rejectMyTrip(user: UserDocument) {
    await this.assertDriverVerified(user);

    const ambulance = await this.findDriverAmbulance(user);
    const trip = await this.emergencyRequestModel.findOne({
      assignedAmbulance: ambulance._id,
      status: EmergencyRequestStatus.ASSIGNED,
    });

    if (!trip) {
      throw new NotFoundException('No assigned trip found to reject');
    }

    // Track rejected ambulance to skip it on re-assignment
    trip.rejectedAmbulances = [
      ...((trip.rejectedAmbulances ?? []) as Types.ObjectId[]),
      ambulance._id as Types.ObjectId,
    ];

    // Reset request back to pending (unassigned)
    trip.assignedAmbulance = null;
    trip.status = EmergencyRequestStatus.PENDING;
    trip.assignedAt = null;
    await trip.save();

    // Release ambulance back to available
    await this.releaseAmbulance(ambulance._id as Types.ObjectId);

    const result = await this.findOne(trip.id);
    this.emitEmergencyRequestUpdated(result);

    // Try to assign to next nearest ambulance (excluding rejected ones)
    this.tryAssignPendingRequests().catch((err) => {
      console.error('[RejectMyTrip] Auto-assign error:', err);
    });

    return { message: 'Trip rejected successfully' };
  }

  private async findPatientOwnedRequest(id: string, user: UserDocument) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Emergency request not found');
    }

    const request = await this.emergencyRequestModel.findOne({
      _id: new Types.ObjectId(id),
      patient: user._id,
    });

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    return request;
  }

  private async populateRequest(request: EmergencyRequestDocument) {
    return request.populate(['assignedAmbulance', 'assignedHospital']);
  }

  private async findDriverAmbulance(
    user: UserDocument,
  ): Promise<AmbulanceDocument> {
    const ambulance = await this.ambulanceModel.findOne({
      phone: user.phone,
      isActive: true,
    });

    if (!ambulance) {
      throw new NotFoundException('Driver ambulance not found');
    }

    return ambulance;
  }

  private async assertCanAccessRequest(
    request: EmergencyRequestDocument,
    user?: UserDocument,
  ) {
    if (!user) {
      return;
    }

    if (user.role === UserRole.PATIENT) {
      this.assertPatientOwnsRequest(request, user);
    }

    if (user.role === UserRole.DRIVER) {
      await this.assertDriverOwnsRequest(request, user);
    }
  }

  private async assertCanCancelRequest(
    request: EmergencyRequestDocument,
    user?: UserDocument,
  ) {
    if (!user) {
      return;
    }

    if (user.role === UserRole.PATIENT) {
      this.assertPatientOwnsRequest(request, user);
    }
  }

  private async assertCanUpdateStatus(
    request: EmergencyRequestDocument,
    user?: UserDocument,
  ) {
    if (!user) {
      return;
    }

    if (user.role === UserRole.DRIVER) {
      await this.assertDriverOwnsRequest(request, user);
    }
  }

  private assertPatientOwnsRequest(
    request: EmergencyRequestDocument,
    user: UserDocument,
  ) {
    if (request.patient?.toString() !== user._id.toString()) {
      throw new NotFoundException('Emergency request not found');
    }
  }

  private async assertDriverOwnsRequest(
    request: EmergencyRequestDocument,
    user: UserDocument,
  ) {
    await this.assertDriverVerified(user);

    if (!request.assignedAmbulance) {
      throw new NotFoundException('Emergency request not found');
    }

    const ambulance = await this.findDriverAmbulance(user);

    if (request.assignedAmbulance.toString() !== ambulance._id.toString()) {
      throw new NotFoundException('Emergency request not found');
    }
  }

  private async assertDriverVerified(user: UserDocument) {
    await this.roleProfilesService.assertDriverVerified(
      user._id as Types.ObjectId,
    );
  }

  private async findNearestAvailableAmbulance(
    coordinates: [number, number],
  ): Promise<AmbulanceDocument | null> {
    return this.ambulanceModel.findOne({
      isActive: true,
      status: AmbulanceStatus.AVAILABLE,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates,
          },
        },
      },
    });
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async claimNearestAvailableAmbulance(
    coordinates: [number, number],
    assignedAt: Date,
    excludeAmbulanceIds: Types.ObjectId[] = [],
  ): Promise<AmbulanceDocument | null> {
    const filter: Record<string, unknown> = {
      isActive: true,
      status: AmbulanceStatus.AVAILABLE,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates,
          },
        },
      },
    };

    if (excludeAmbulanceIds.length > 0) {
      filter._id = { $nin: excludeAmbulanceIds };
    }

    const candidates = await this.ambulanceModel.find(filter).limit(20);

    for (const candidate of candidates) {
      const claimed = await this.ambulanceModel.findOneAndUpdate(
        {
          _id: candidate._id,
          isActive: true,
          status: AmbulanceStatus.AVAILABLE,
        },
        {
          $set: {
            status: AmbulanceStatus.ASSIGNED,
            assignedAt,
          },
        },
        { returnDocument: 'after' },
      );

      if (claimed) {
        return claimed;
      }
    }

    return null;
  }

  private async findAvailableAmbulanceById(
    ambulanceId: string,
  ): Promise<AmbulanceDocument> {
    if (!isValidObjectId(ambulanceId)) {
      throw new BadRequestException('Invalid ambulance id');
    }

    const ambulance = await this.ambulanceModel.findById(ambulanceId);

    if (!ambulance) {
      throw new NotFoundException('Ambulance not found');
    }

    if (!ambulance.isActive || ambulance.status !== AmbulanceStatus.AVAILABLE) {
      throw new BadRequestException('Selected ambulance is not available');
    }

    return ambulance;
  }

  private async claimAvailableAmbulanceById(
    ambulanceId: string,
    assignedAt: Date,
  ): Promise<AmbulanceDocument> {
    if (!isValidObjectId(ambulanceId)) {
      throw new BadRequestException('Invalid ambulance id');
    }

    const ambulance = await this.ambulanceModel.findById(ambulanceId);

    if (!ambulance) {
      throw new NotFoundException('Ambulance not found');
    }

    const claimed = await this.ambulanceModel.findOneAndUpdate(
      {
        _id: ambulance._id,
        isActive: true,
        status: AmbulanceStatus.AVAILABLE,
      },
      {
        $set: {
          status: AmbulanceStatus.ASSIGNED,
          assignedAt,
        },
      },
      { returnDocument: 'after' },
    );

    if (!claimed) {
      throw new BadRequestException('Selected ambulance is not available');
    }

    return claimed;
  }

  /**
   * Releases an ambulance back to AVAILABLE status and then immediately tries
   * to auto-assign any pending requests so that no idle ambulance and pending
   * request ever co-exist.
   */
  private async releaseAmbulance(ambulanceId: Types.ObjectId) {
    await this.releaseAmbulanceCore(ambulanceId);

    // Fire-and-forget: try to assign any waiting pending requests.
    // Must not await — we don't want to block the caller's response.
    this.tryAssignPendingRequests().catch((err) => {
      console.error('[EmergencyRequestService] Auto-assign error after release:', err);
    });
  }

  /**
   * Core release logic: sets the ambulance back to AVAILABLE without
   * triggering auto-assignment.  Used internally by tryAssignPendingRequests
   * to avoid infinite recursion.
   */
  private async releaseAmbulanceCore(ambulanceId: Types.ObjectId) {
    const ambulance = await this.ambulanceModel.findById(ambulanceId);

    if (!ambulance) {
      return;
    }

    ambulance.status = AmbulanceStatus.AVAILABLE;
    ambulance.assignedAt = null;
    ambulance.reachedPatientAt = null;
    ambulance.transportStartedAt = null;
    ambulance.reachedHospitalAt = null;
    ambulance.completedAt = null;

    await ambulance.save();
  }

  /**
   * Scans for pending (unassigned) emergency requests and attempts to dispatch
   * each one using the nearest available ambulance + hospital.
   *
   * Invariant enforced: an available ambulance and a pending request must
   * never co-exist — this method is called every time an ambulance becomes free.
   *
   * Public so that AmbulanceService can also call it when a driver manually
   * sets their ambulance back to AVAILABLE via the status update endpoint.
   */
  async tryAssignPendingRequests(): Promise<void> {
    console.log('[AutoAssign] tryAssignPendingRequests() called');

    const pendingRequests = await this.emergencyRequestModel
      .find({
        status: EmergencyRequestStatus.PENDING,
        assignedAmbulance: null,
      })
      .sort({ createdAt: 1 }) // oldest first
      .limit(10);

    console.log(`[AutoAssign] Found ${pendingRequests.length} pending request(s)`);

    for (const request of pendingRequests) {
      try {
        const pickupCoords = request.pickupLocation.coordinates;
        const assignedAt = new Date();

        console.log(`[AutoAssign] Trying request ${request._id} at coords ${pickupCoords}`);

        const ambulance = await this.claimNearestAvailableAmbulance(
          pickupCoords,
          assignedAt,
          (request.rejectedAmbulances ?? []) as Types.ObjectId[],
        );

        if (!ambulance) {
          console.log('[AutoAssign] No available ambulance found — stopping.');
          break;
        }

        console.log(`[AutoAssign] Claimed ambulance ${ambulance._id} (${ambulance.ambulanceCode})`);

        // Determine hospital (respect user-chosen hospital if already set)
        let hospitalId: Types.ObjectId | null = request.assignedHospital
          ? (request.assignedHospital as Types.ObjectId)
          : null;

        if (!hospitalId) {
          const hospital = await this.findNearestValidHospital(pickupCoords);

          if (!hospital) {
            console.log('[AutoAssign] No valid hospital found — releasing ambulance.');
            await this.releaseAmbulanceCore(ambulance._id as Types.ObjectId);
            continue;
          }

          console.log(`[AutoAssign] Found hospital ${hospital._id} (${hospital.name})`);
          hospitalId = hospital._id as Types.ObjectId;
          request.hospitalAssignmentTechnique =
            HospitalAssignmentTechnique.SYSTEM_AUTO;
        }

        const reserved = await this.reserveHospitalBed(hospitalId);

        if (!reserved) {
          console.log('[AutoAssign] Hospital bed reservation failed — releasing ambulance.');
          await this.releaseAmbulanceCore(ambulance._id as Types.ObjectId);
          continue;
        }

        request.assignedAmbulance = ambulance._id as Types.ObjectId;
        request.assignedHospital = hospitalId;
        request.status = EmergencyRequestStatus.ASSIGNED;
        request.assignedAt = assignedAt;
        request.hospitalBedReserved = true;

        await request.save();

        console.log(`[AutoAssign] ✅ Request ${request._id} assigned to ambulance ${ambulance.ambulanceCode}`);

        const result = await this.findOne(request.id);
        this.emitEmergencyRequestDispatched(result);
      } catch (error) {
        console.error('[AutoAssign] Error processing request:', error);
      }
    }

    console.log('[AutoAssign] tryAssignPendingRequests() complete');
  }

  private async reserveHospitalBed(
    hospitalId: Types.ObjectId | null | undefined,
  ) {
    if (!hospitalId) {
      return false;
    }

    const updated = await this.hospitalModel.findOneAndUpdate(
      {
        _id: hospitalId,
        status: 'available',
        availableBeds: { $gt: 0 },
      },
      {
        $inc: { availableBeds: -1 },
      },
      { returnDocument: 'after' },
    );

    return !!updated;
  }

  private async releaseHospitalBed(
    hospitalId: Types.ObjectId | null | undefined,
  ) {
    if (!hospitalId) {
      return;
    }

    await this.hospitalModel.updateOne(
      {
        _id: hospitalId,
        $expr: { $lt: ['$availableBeds', '$capacity'] },
      },
      {
        $inc: { availableBeds: 1 },
      },
    );
  }

  private shouldReleaseReservedBedOnCancellation(
    request: EmergencyRequestDocument,
  ) {
    return (
      !!request.hospitalBedReserved &&
      !!request.assignedHospital &&
      request.status !== EmergencyRequestStatus.AT_HOSPITAL &&
      request.status !== EmergencyRequestStatus.COMPLETED
    );
  }

  private shouldReserveBedForRequest(request: EmergencyRequestDocument) {
    return (
      request.status !== EmergencyRequestStatus.PENDING &&
      request.status !== EmergencyRequestStatus.CANCELLED &&
      request.status !== EmergencyRequestStatus.COMPLETED
    );
  }

  private async findNearestValidHospital(
    coordinates: [number, number],
  ): Promise<HospitalDocument | null> {
    return this.hospitalModel
      .findOne({
        status: 'available',
        availableBeds: { $gt: 0 },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates,
            },
          },
        },
      })
      .exec();
  }

  private async findValidHospitalById(
    hospitalId: string,
  ): Promise<HospitalDocument> {
    if (!isValidObjectId(hospitalId)) {
      throw new BadRequestException('Invalid hospital id');
    }

    const hospital = await this.hospitalModel.findById(hospitalId);

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    if (hospital.status !== 'available' || hospital.availableBeds <= 0) {
      throw new BadRequestException('Selected hospital is not available');
    }

    return hospital;
  }

  private assertRequestNotDispatched(request: EmergencyRequestDocument) {
    if (
      request.status !== EmergencyRequestStatus.PENDING ||
      request.assignedAmbulance ||
      request.assignedHospital
    ) {
      throw new BadRequestException('Emergency request is already dispatched');
    }
  }

  private async resolveHospitalForDispatch(
    dto: DispatchEmergencyRequestDto,
    coordinates: [number, number],
  ): Promise<HospitalDocument> {
    if (
      dto.hospitalAssignmentTechnique ===
      HospitalAssignmentTechnique.SYSTEM_AUTO
    ) {
      if (dto.hospitalId) {
        throw new BadRequestException(
          'hospitalId is not allowed for system-auto assignment',
        );
      }

      const hospital = await this.findNearestValidHospital(coordinates);

      if (!hospital) {
        throw new NotFoundException('No available hospital found');
      }

      return hospital;
    }

    if (!dto.hospitalId) {
      throw new BadRequestException('hospitalId is required');
    }

    return this.findValidHospitalById(dto.hospitalId);
  }

  private async syncAssignedAmbulanceStatus(
    request: EmergencyRequestDocument,
    requestStatus: EmergencyRequestStatus,
  ) {
    if (!request.assignedAmbulance) {
      return;
    }

    const ambulance = await this.ambulanceModel.findById(
      request.assignedAmbulance,
    );

    if (!ambulance) {
      return;
    }

    if (requestStatus === EmergencyRequestStatus.ASSIGNED) {
      ambulance.status = AmbulanceStatus.ASSIGNED;
      ambulance.assignedAt = request.assignedAt ?? new Date();
    }

    if (requestStatus === EmergencyRequestStatus.EN_ROUTE) {
      ambulance.status = AmbulanceStatus.EN_ROUTE;
    }

    if (requestStatus === EmergencyRequestStatus.AT_PATIENT) {
      ambulance.status = AmbulanceStatus.AT_PATIENT;
      ambulance.reachedPatientAt = request.reachedPatientAt ?? new Date();
    }

    if (requestStatus === EmergencyRequestStatus.TRANSPORTING) {
      ambulance.status = AmbulanceStatus.TRANSPORTING;
      ambulance.transportStartedAt = new Date();
    }

    if (requestStatus === EmergencyRequestStatus.AT_HOSPITAL) {
      ambulance.status = AmbulanceStatus.AT_HOSPITAL;
      ambulance.reachedHospitalAt = new Date();
    }

    if (requestStatus === EmergencyRequestStatus.COMPLETED) {
      ambulance.status = AmbulanceStatus.COMPLETED;
      ambulance.completedAt = request.completedAt ?? new Date();
    }

    if (requestStatus === EmergencyRequestStatus.CANCELLED) {
      ambulance.status = AmbulanceStatus.AVAILABLE;
      ambulance.assignedAt = null;
      ambulance.reachedPatientAt = null;
      ambulance.transportStartedAt = null;
      ambulance.reachedHospitalAt = null;
      ambulance.completedAt = null;
    }

    if (requestStatus === EmergencyRequestStatus.PENDING) {
      ambulance.status = AmbulanceStatus.AVAILABLE;
      ambulance.assignedAt = null;
      ambulance.reachedPatientAt = null;
      ambulance.transportStartedAt = null;
      ambulance.reachedHospitalAt = null;
      ambulance.completedAt = null;
    }

    await ambulance.save();
  }
}
