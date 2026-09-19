import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../constants/enums';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { User, UserDocument } from './entities/user.entity';

export type SanitizedUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async findAll(query: FindUsersQueryDto = {}) {
    const filter: Record<string, unknown> = {};

    if (query.role) {
      filter.role = query.role;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.search) {
      const regex = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: users.map((user) => this.sanitize(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async requireById(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateLastLoginAt(id: string | Types.ObjectId): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { lastLoginAt: new Date() },
        { returnDocument: 'after' },
      )
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateStatus(
    id: string,
    isActive: boolean,
    currentUser: UserDocument,
  ) {
    this.assertValidObjectId(id);

    if (currentUser._id.toString() === id && !isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, { isActive }, { returnDocument: 'after' })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitize(user);
  }

  async remove(id: string, currentUser: UserDocument) {
    this.assertValidObjectId(id);

    if (currentUser._id.toString() === id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const deleted = await this.userModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User deleted successfully' };
  }

  sanitize(user: UserDocument): SanitizedUser {
    return {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private assertValidObjectId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('User not found');
    }
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
