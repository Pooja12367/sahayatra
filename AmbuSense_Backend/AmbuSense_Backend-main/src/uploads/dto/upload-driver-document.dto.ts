import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadDriverDocumentDto {
  @ApiProperty({ example: 'Driving License' })
  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @ApiPropertyOptional({
    description: 'Required when an admin uploads a document for a driver.',
    example: '65f1a6f2c3b7a91d2e4f5684',
  })
  @IsOptional()
  @IsMongoId()
  driverId?: string;
}
