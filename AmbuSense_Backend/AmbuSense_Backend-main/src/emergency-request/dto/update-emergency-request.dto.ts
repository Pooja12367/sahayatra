import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmergencyRequestDto {
  @ApiPropertyOptional({ example: 'Sita Tamang' })
  @IsOptional()
  @IsString()
  patientName?: string;

  @ApiPropertyOptional({ example: '+9779800000202' })
  @IsOptional()
  @IsString()
  patientPhone?: string;

  @ApiPropertyOptional({
    example: [85.324, 27.7172],
    description: '[longitude, latitude]',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  coordinates?: [number, number];

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5680' })
  @IsOptional()
  @IsMongoId()
  assignedAmbulance?: string;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  assignedHospital?: string;

  @ApiPropertyOptional({ example: 'Updated patient notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
