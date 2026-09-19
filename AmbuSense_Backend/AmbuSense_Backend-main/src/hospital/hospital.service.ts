import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { UpdateHospitalDto } from './dto/update-hospital.dto';
import { Hospital, HospitalDocument } from './entities/hospital.entity';
import { FindHospitalsQueryDto } from './dto/find-hospitals-query.dto';

@Injectable()
export class HospitalService {
  constructor(
    @InjectModel(Hospital.name)
    private readonly hospitalModel: Model<HospitalDocument>,
  ) {}

  async create(createHospitalDto: CreateHospitalDto) {
    const { coordinates, ...rest } = createHospitalDto;

    return this.hospitalModel.create({
      ...rest,
      location: {
        type: 'Point',
        coordinates,
      },
    });
  }

  async findAll(query: FindHospitalsQueryDto = {}) {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.hasAvailableBeds !== undefined) {
      filter.availableBeds = query.hasAvailableBeds ? { $gt: 0 } : 0;
    }

    if (query.search) {
      const regex = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [
        { name: regex },
        { phone: regex },
        { address: regex },
        { specialization: regex },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.hospitalModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.hospitalModel.countDocuments(filter).exec(),
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
    const hospital = await this.hospitalModel.findById(id);

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    return hospital;
  }

  async update(id: string, dto: UpdateHospitalDto) {
    const updateData: Record<string, unknown> = { ...dto };

    if (dto.coordinates) {
      updateData.location = {
        type: 'Point',
        coordinates: dto.coordinates,
      };
      delete updateData.coordinates;
    }

    const updated = await this.hospitalModel.findByIdAndUpdate(id, updateData, {
      returnDocument: 'after',
    });

    if (!updated) {
      throw new NotFoundException('Hospital not found');
    }

    return updated;
  }

  async remove(id: string) {
    const deleted = await this.hospitalModel.findByIdAndDelete(id);

    if (!deleted) {
      throw new NotFoundException('Hospital not found');
    }

    return { message: 'Hospital deleted successfully' };
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
