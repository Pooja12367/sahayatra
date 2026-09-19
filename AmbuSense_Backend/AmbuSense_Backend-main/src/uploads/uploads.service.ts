import { BadRequestException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserRole } from '../constants/enums';
import { MediaService } from '../media/media.service';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import { UserDocument } from '../users/entities/user.entity';
import { UploadDriverDocumentDto } from './dto/upload-driver-document.dto';

@Injectable()
export class UploadsService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly roleProfilesService: RoleProfilesService,
  ) {}

  async uploadDriverDocument(
    file: Express.Multer.File | undefined,
    dto: UploadDriverDocumentDto,
    user: UserDocument,
  ) {
    if (!file) {
      throw new BadRequestException('Document image is required');
    }

    if (user.role === UserRole.ADMIN && !dto.driverId) {
      throw new BadRequestException('driverId is required for admin uploads');
    }

    const media = await this.mediaService.create({
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      url: `/api/uploads/documents/${file.filename}`,
      uploadedBy: user._id as Types.ObjectId,
    });

    const driverProfile =
      user.role === UserRole.ADMIN
        ? await this.attachAdminUploadedDocument(dto, media.id)
        : await this.roleProfilesService.attachDriverDocument(
            user._id as Types.ObjectId,
            dto.documentType,
            media.id,
          );

    return {
      media,
      driverProfile,
    };
  }

  findMediaById(id: string) {
    return this.mediaService.findById(id);
  }

  private async attachAdminUploadedDocument(
    dto: UploadDriverDocumentDto,
    mediaId: string,
  ) {
    return this.roleProfilesService.attachDriverDocumentById(
      dto.driverId as string,
      dto.documentType,
      mediaId,
    );
  }
}
