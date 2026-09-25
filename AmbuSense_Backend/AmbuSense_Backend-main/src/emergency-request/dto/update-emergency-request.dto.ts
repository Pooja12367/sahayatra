import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
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
  @MaxLength(20)
  @Matches(/^(?:\+?977[-\s]?)?(?:0?[97]\d{9})$/)
  patientPhone?: string;

  @ApiPropertyOptional({
    example: [85.324, 27.7172],
    description: '[longitude, latitude]',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates?: [number, number];

  @ApiPropertyOptional({ example: 'Kathmandu, Nepal', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupAddress?: string;

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
