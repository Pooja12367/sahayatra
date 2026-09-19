import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Media, MediaDocument } from './entities/media.entity';

type CreateMediaInput = {
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedBy: Types.ObjectId;
};

@Injectable()
export class MediaService {
  constructor(
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
  ) {}

  async create(input: CreateMediaInput) {
    const media = await this.mediaModel.create(input);
    return this.sanitize(media);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid media id');
    }

    const media = await this.mediaModel.findById(id);

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    return this.sanitize(media);
  }

  sanitize(media: MediaDocument) {
    return {
      id: media._id.toString(),
      originalName: media.originalName,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      path: media.path,
      url: media.url,
      uploadedBy: media.uploadedBy.toString(),
    };
  }
}
