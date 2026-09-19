import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Ambulance,
  AmbulanceDocument,
} from '../ambulance/entities/ambulance.entity';
import {
  AmbulanceStatus,
  EmergencyRequestStatus,
} from '../constants/enums';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from '../emergency-request/entities/emergency-request.entity';
import { Hospital, HospitalDocument } from '../hospital/entities/hospital.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(EmergencyRequest.name)
    private readonly emergencyRequestModel: Model<EmergencyRequestDocument>,
    @InjectModel(Ambulance.name)
    private readonly ambulanceModel: Model<AmbulanceDocument>,
    @InjectModel(Hospital.name)
    private readonly hospitalModel: Model<HospitalDocument>,
  ) {}

  async getSummary() {
    const requestStatuses = Object.values(EmergencyRequestStatus);
    const ambulanceStatuses = Object.values(AmbulanceStatus);

    const [
      totalEmergencyRequests,
      emergencyRequestsByStatus,
      totalAmbulances,
      ambulancesByStatus,
      activeAmbulances,
      totalHospitals,
      availableHospitals,
      hospitalsWithAvailableBeds,
    ] = await Promise.all([
      this.emergencyRequestModel.countDocuments(),
      this.emergencyRequestModel.aggregate<{
        _id: EmergencyRequestStatus;
        count: number;
      }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.ambulanceModel.countDocuments(),
      this.ambulanceModel.aggregate<{
        _id: AmbulanceStatus;
        count: number;
      }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.ambulanceModel.countDocuments({ isActive: true }),
      this.hospitalModel.countDocuments(),
      this.hospitalModel.countDocuments({ status: 'available' }),
      this.hospitalModel.countDocuments({
        status: 'available',
        availableBeds: { $gt: 0 },
      }),
    ]);

    const emergencyRequestCounts = this.mapCountsByStatus(
      requestStatuses,
      emergencyRequestsByStatus,
    );
    const ambulanceCounts = this.mapCountsByStatus(
      ambulanceStatuses,
      ambulancesByStatus,
    );

    return {
      emergencyRequests: {
        total: totalEmergencyRequests,
        active:
          totalEmergencyRequests -
          emergencyRequestCounts[EmergencyRequestStatus.COMPLETED] -
          emergencyRequestCounts[EmergencyRequestStatus.CANCELLED],
        byStatus: emergencyRequestCounts,
      },
      ambulances: {
        total: totalAmbulances,
        active: activeAmbulances,
        byStatus: ambulanceCounts,
      },
      hospitals: {
        total: totalHospitals,
        available: availableHospitals,
        withAvailableBeds: hospitalsWithAvailableBeds,
      },
    };
  }

  private mapCountsByStatus<T extends string>(
    statuses: T[],
    counts: { _id: T; count: number }[],
  ): Record<T, number> {
    const mapped = statuses.reduce(
      (acc, status) => ({
        ...acc,
        [status]: 0,
      }),
      {} as Record<T, number>,
    );

    counts.forEach((item) => {
      mapped[item._id] = item.count;
    });

    return mapped;
  }
}
