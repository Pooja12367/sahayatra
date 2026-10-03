import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  Ambulance,
  AmbulanceDocument,
} from '../ambulance/entities/ambulance.entity';
import {
  EmergencyRequest,
  EmergencyRequestDocument,
} from '../emergency-request/entities/emergency-request.entity';
import {
  Hospital,
  HospitalDocument,
} from '../hospital/entities/hospital.entity';
import { UserRole } from '../constants/enums';
import type { UserDocument } from '../users/entities/user.entity';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import { areNepalPhoneNumbersEqual } from '../users/phone.util';

type Coordinates = [number, number];

type OsrmGeometry = {
  type: string;
  coordinates: number[][];
};

type RouteLeg = {
  sourceCoordinates: Coordinates;
  destinationCoordinates: Coordinates;
  distanceInMeters: number;
  durationInSeconds: number;
  durationInMinutes: number;
  geometry: OsrmGeometry;
};

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: OsrmGeometry;
};

type OsrmResponse = {
  code?: string;
  message?: string;
  routes?: OsrmRoute[];
};

@Injectable()
export class RoutesService {
  private readonly osrmBaseUrl: string;

  constructor(
    @InjectModel(Ambulance.name)
    private readonly ambulanceModel: Model<AmbulanceDocument>,
    @InjectModel(EmergencyRequest.name)
    private readonly emergencyRequestModel: Model<EmergencyRequestDocument>,
    @InjectModel(Hospital.name)
    private readonly hospitalModel: Model<HospitalDocument>,
    private readonly configService: ConfigService,
    private readonly roleProfilesService: RoleProfilesService,
  ) {
    this.osrmBaseUrl =
      this.configService.get<string>('OSRM_BASE_URL') ??
      'https://router.project-osrm.org';
  }

  async getAmbulanceToRequestRoute(
    ambulanceId: string,
    requestId: string,
    user?: UserDocument,
  ) {
    const ambulance = await this.findAmbulance(ambulanceId);
    const request = await this.findRequest(requestId);
    await this.assertCanAccessRoute(request, user, ambulance.id);

    return this.getRouteLeg(
      ambulance.currentLocation.coordinates,
      request.pickupLocation.coordinates,
    );
  }

  async getRequestToHospitalRoute(requestId: string, user?: UserDocument) {
    const request = await this.findRequest(requestId);
    await this.assertCanAccessRoute(request, user);
    const hospital = await this.findAssignedHospital(request);

    return this.getRouteLeg(
      request.pickupLocation.coordinates,
      hospital.location.coordinates,
    );
  }

  async getFullRequestRoute(requestId: string, user?: UserDocument) {
    const request = await this.findRequest(requestId);
    await this.assertCanAccessRoute(request, user);

    if (!request.assignedAmbulance) {
      throw new BadRequestException(
        'Emergency request does not have an assigned ambulance',
      );
    }

    const ambulance = await this.findAmbulance(
      request.assignedAmbulance.toString(),
    );
    const hospital = await this.findAssignedHospital(request);

    this.assertValidCoordinates(ambulance.currentLocation.coordinates);
    this.assertValidCoordinates(request.pickupLocation.coordinates);
    this.assertValidCoordinates(hospital.location.coordinates);

    const ambulanceToPickup = await this.getRouteLeg(
      ambulance.currentLocation.coordinates,
      request.pickupLocation.coordinates,
    );
    const pickupToHospital = await this.getRouteLeg(
      request.pickupLocation.coordinates,
      hospital.location.coordinates,
    );

    return {
      ambulanceToPickup,
      pickupToHospital,
      totalDistance:
        ambulanceToPickup.distanceInMeters + pickupToHospital.distanceInMeters,
      totalDuration:
        ambulanceToPickup.durationInSeconds +
        pickupToHospital.durationInSeconds,
    };
  }

  private async findAmbulance(id: string) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Ambulance not found');
    }

    const ambulance = await this.ambulanceModel.findById(id);

    if (!ambulance) {
      throw new NotFoundException('Ambulance not found');
    }

    return ambulance;
  }

  private async findRequest(id: string) {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Emergency request not found');
    }

    const request = await this.emergencyRequestModel.findById(id);

    if (!request) {
      throw new NotFoundException('Emergency request not found');
    }

    return request;
  }

  private async assertCanAccessRoute(
    request: EmergencyRequestDocument,
    user?: UserDocument,
    requestedAmbulanceId?: string,
  ) {
    if (
      !user ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.DISPATCHER
    ) {
      return;
    }

    if (user.role === UserRole.PATIENT) {
      if (request.patient?.toString() !== user._id.toString()) {
        throw new NotFoundException('Emergency request not found');
      }
      return;
    }

    if (user.role === UserRole.DRIVER) {
      await this.roleProfilesService.assertDriverVerified(
        user._id as Types.ObjectId,
      );

      if (
        requestedAmbulanceId &&
        requestedAmbulanceId !== request.assignedAmbulance?.toString()
      ) {
        throw new NotFoundException('Ambulance not found');
      }

      if (!request.assignedAmbulance) {
        throw new NotFoundException('Emergency request not found');
      }

      if (request.assignedDriverId) {
        if (request.assignedDriverId.toString() !== user._id.toString()) {
          throw new NotFoundException('Emergency request not found');
        }
        return;
      }

      const ambulance = await this.findAmbulance(
        request.assignedAmbulance.toString(),
      );
      if (!areNepalPhoneNumbersEqual(ambulance.phone, user.phone)) {
        throw new NotFoundException('Emergency request not found');
      }
    }
  }

  private async findAssignedHospital(request: EmergencyRequestDocument) {
    if (!request.assignedHospital) {
      throw new BadRequestException(
        'Emergency request does not have an assigned hospital',
      );
    }

    const hospital = await this.hospitalModel.findById(
      request.assignedHospital,
    );

    if (!hospital) {
      throw new NotFoundException('Assigned hospital not found');
    }

    return hospital;
  }

  private async getRouteLeg(
    sourceCoordinates: Coordinates,
    destinationCoordinates: Coordinates,
  ): Promise<RouteLeg> {
    this.assertValidCoordinates(sourceCoordinates);
    this.assertValidCoordinates(destinationCoordinates);

    const route = await this.fetchOsrmRoute(
      sourceCoordinates,
      destinationCoordinates,
    );

    return {
      sourceCoordinates,
      destinationCoordinates,
      distanceInMeters: route.distance,
      durationInSeconds: route.duration,
      durationInMinutes: Math.round((route.duration / 60) * 100) / 100,
      geometry: route.geometry,
    };
  }

  private async fetchOsrmRoute(
    sourceCoordinates: Coordinates,
    destinationCoordinates: Coordinates,
  ): Promise<Required<OsrmRoute>> {
    const [sourceLng, sourceLat] = sourceCoordinates;
    const [destinationLng, destinationLat] = destinationCoordinates;
    const baseUrl = this.osrmBaseUrl.replace(/\/$/, '');
    const url =
      `${baseUrl}/route/v1/driving/` +
      `${sourceLng},${sourceLat};${destinationLng},${destinationLat}` +
      '?overview=full&geometries=geojson';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response | undefined;
    let data: OsrmResponse;

    try {
      response = await fetch(url, { signal: controller.signal });
      data = (await response.json()) as OsrmResponse;
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new GatewayTimeoutException('OSRM request timed out');
      }
      if (!response) {
        throw new BadGatewayException('Failed to reach OSRM server');
      }
      throw new BadGatewayException('Invalid OSRM response');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new BadGatewayException(data.message || 'OSRM request failed');
    }

    const route = data.routes?.[0];

    if (
      data.code !== 'Ok' ||
      !route ||
      typeof route.distance !== 'number' ||
      typeof route.duration !== 'number' ||
      !route.geometry
    ) {
      throw new NotFoundException('No route found');
    }

    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    };
  }

  private assertValidCoordinates(coordinates: Coordinates) {
    const [longitude, latitude] = coordinates ?? [];
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new BadRequestException(
        'Route locations must contain valid longitude and latitude coordinates',
      );
    }
  }
}
