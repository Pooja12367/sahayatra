import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmergencyRequestDto {
  @ApiProperty({ example: 'Sita Tamang' })
  @IsString()
  @IsNotEmpty()
  patientName!: string;

  @ApiProperty({ example: '+9779800000202' })
  @IsString()
  @IsNotEmpty()
  patientPhone!: string;

  @ApiProperty({
    example: [85.324, 27.7172],
    minItems: 2,
    maxItems: 2,
    description: '[longitude, latitude]',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  coordinates!: [number, number];

  @ApiPropertyOptional({ example: 'Patient has chest pain' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  assignedHospital?: string;
}
