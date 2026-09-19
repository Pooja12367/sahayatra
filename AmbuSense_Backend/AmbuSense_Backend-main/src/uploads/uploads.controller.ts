import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../constants/enums';
import type { UserDocument } from '../users/entities/user.entity';
import { UploadDriverDocumentDto } from './dto/upload-driver-document.dto';
import { UploadsService } from './uploads.service';
import { driverProfileExample, mediaExample } from '../swagger/api-examples';

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@ApiTags('Uploads')
@ApiCookieAuth('session')
@Controller('uploads')
@UseGuards(AuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('media/:id')
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.PATIENT)
  getMedia(@Param('id') id: string) {
    return this.uploadsService.findMediaById(id);
  }

  @Post('driver-document')
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload a driver verification document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG, or WebP document image.',
        },
        documentType: { type: 'string', example: 'Driving License' },
        driverId: {
          type: 'string',
          example: driverProfileExample.id,
          description: 'Required only for admin uploads.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded and attached to the driver profile.',
    schema: {
      example: {
        media: mediaExample,
        driverProfile: driverProfileExample,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or upload payload.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'documents'),
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase();
          callback(null, `${Date.now()}-${randomUUID()}${extension}`);
        },
      }) as never,
      fileFilter: (_req, file, callback) => {
        if (!allowedImageMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              'Only JPEG, PNG, and WebP images are allowed',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  uploadDriverDocument(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDriverDocumentDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.uploadsService.uploadDriverDocument(file, dto, user);
  }
}
