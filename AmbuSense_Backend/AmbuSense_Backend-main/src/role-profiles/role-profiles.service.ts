import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../constants/enums';
import type { UserDocument } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { FindDriversQueryDto } from '../drivers/dto/find-drivers-query.dto';
import {
  Ambulance,
  AmbulanceDocument,
} from '../ambulance/entities/ambulance.entity';
import { Admin, AdminDocument } from './entities/admin.entity';
import { Dispatcher, DispatcherDocument } from './entities/dispatcher.entity';
import { Driver, DriverDocument } from './entities/driver.entity';
import { Patient, PatientDocument } from './entities/patient.entity';

type ProfileDocument =
  | AdminDocument
  | DispatcherDocument
  | DriverDocument
  | PatientDocument;

@Injectable()
export class RoleProfilesService {
  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(Dispatcher.name)
    private readonly dispatcherModel: Model<DispatcherDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Patient.name)
    private readonly patientModel: Model<PatientDocument>,
    @InjectModel(Ambulance.name)
    private readonly ambulanceModel: Model<AmbulanceDocument>,
    private readonly usersService: UsersService,
  ) {}

  async createForRole(role: UserRole, user: Types.ObjectId) {
    const model = this.getModel(role);
    const profile = await model.create({ user });
    return this.sanitize(profile);
  }

  async findByUser(role: UserRole, user: string | Types.ObjectId) {
    const profile = await this.getModel(role).findOne({ user }).exec();
    return profile ? this.sanitize(profile) : null;
  }

  async findDrivers(query: FindDriversQueryDto = {}) {
    const filter =
      query.isVerified === undefined
        ? {}
        : {
            isVerified: query.isVerified,
          };

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const [profiles, total] = await Promise.all([
      this.driverModel
        .find(filter)
        .populate('user')
        .populate('documentImageId')
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.driverModel.countDocuments(filter).exec(),
    ]);

    const phones = profiles
      .map((profile) => {
        const user = profile.user as unknown as { phone?: string };
        return user.phone;
      })
      .filter((phone): phone is string => Boolean(phone));

    const ambulances = await this.ambulanceModel
      .find({ phone: { $in: phones } })
      .sort({ updatedAt: -1, createdAt: -1 })
      .exec();

    const ambulanceByPhone = new Map<string, AmbulanceDocument>();
    ambulances.forEach((ambulance) => {
      if (!ambulanceByPhone.has(ambulance.phone)) {
        ambulanceByPhone.set(ambulance.phone, ambulance);
      }
    });

    return {
      data: profiles.map((profile) => {
        const user = profile.user as unknown as { phone?: string };
        return this.sanitizeDriverForAdmin(
          profile,
          user.phone ? ambulanceByPhone.get(user.phone) : null,
        );
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async assertDriverVerified(user: string | Types.ObjectId) {
    const profile = await this.driverModel.findOne({ user }).exec();

    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    if (!profile.isVerified) {
      throw new ForbiddenException('Driver verification is required');
    }
  }

  async attachDriverDocument(
    user: string | Types.ObjectId,
    documentType: string,
    documentImageId: string | Types.ObjectId,
  ) {
    const profile = await this.driverModel
      .findOneAndUpdate(
        { user },
        {
          documentType,
          documentImageId,
          isVerified: false,
          verificationNote: null,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.sanitize(profile);
  }

  async attachDriverDocumentById(
    id: string,
    documentType: string,
    documentImageId: string | Types.ObjectId,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid driver id');
    }

    const profile = await this.driverModel
      .findByIdAndUpdate(
        id,
        {
          documentType,
          documentImageId,
          isVerified: false,
          verificationNote: null,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.sanitize(profile);
  }

  async verifyDriver(
    id: string,
    isVerified: boolean,
    verificationNote?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid driver id');
    }

    const profile = await this.driverModel
      .findByIdAndUpdate(
        id,
        {
          isVerified,
          verificationNote: verificationNote ?? null,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.sanitize(profile);
  }

  async removeDriver(id: string, currentUser: UserDocument) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid driver id');
    }

    const profile = await this.driverModel.findById(id).exec();

    if (!profile) {
      throw new NotFoundException('Driver profile not found');
    }

    const userId = profile.user.toString();

    await this.usersService.remove(userId, currentUser);
    await this.driverModel.findByIdAndDelete(id).exec();

    return { message: 'Driver deleted successfully' };
  }

  private getModel(role: UserRole): Model<ProfileDocument> {
    switch (role) {
      case UserRole.ADMIN:
        return this.adminModel;
      case UserRole.DISPATCHER:
        return this.dispatcherModel;
      case UserRole.DRIVER:
        return this.driverModel;
      case UserRole.PATIENT:
        return this.patientModel;
    }
  }

  private sanitize(profile: ProfileDocument) {
    const sanitized: Record<string, unknown> = {
      id: profile._id.toString(),
      user: profile.user.toString(),
    };

    if (profile instanceof this.driverModel) {
      sanitized.documentType = profile.documentType;
      sanitized.documentImageId = profile.documentImageId?.toString() ?? null;
      sanitized.isVerified = profile.isVerified;
      sanitized.verificationNote = profile.verificationNote;
    }

    return sanitized;
  }

  private sanitizeDriverForAdmin(
    profile: DriverDocument,
    assignedAmbulance?: AmbulanceDocument | null,
  ) {
    const user = profile.user as unknown as {
      _id: Types.ObjectId;
      fullName: string;
      email: string;
      phone: string;
      role: UserRole;
      isActive: boolean;
    };
    const media = profile.documentImageId as unknown as
      | {
          _id: Types.ObjectId;
          originalName: string;
          fileName: string;
          mimeType: string;
          size: number;
          path: string;
          url: string;
          uploadedBy: Types.ObjectId;
        }
      | null;

    return {
      id: profile._id.toString(),
      user: {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
      documentType: profile.documentType,
      documentImageId: media?._id.toString() ?? null,
      documentImage: media
        ? {
            id: media._id.toString(),
            originalName: media.originalName,
            fileName: media.fileName,
            mimeType: media.mimeType,
            size: media.size,
            path: media.path,
            url: media.url,
            uploadedBy: media.uploadedBy.toString(),
          }
        : null,
      assignedAmbulance: assignedAmbulance
        ? {
            id: assignedAmbulance._id.toString(),
            ambulanceCode: assignedAmbulance.ambulanceCode,
            driverName: assignedAmbulance.driverName,
            phone: assignedAmbulance.phone,
            status: assignedAmbulance.status,
            currentLocation: assignedAmbulance.currentLocation,
            isActive: assignedAmbulance.isActive,
            assignedAt: assignedAmbulance.assignedAt,
            createdAt: assignedAmbulance.createdAt,
            updatedAt: assignedAmbulance.updatedAt,
          }
        : null,
      isVerified: profile.isVerified,
      verificationNote: profile.verificationNote,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }
}
