import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsMongoId,
  Matches,
  MaxLength,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmergencyRequestDto {
  @ApiProperty({ example: 'Sita Tamang' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  patientName!: string;

  @ApiProperty({ example: '+9779800000202' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^(?:\+?977[-\s]?)?(?:0?[97]\d{9})$/)
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
  @IsNumber({}, { each: true })
  coordinates!: [number, number];

  @ApiPropertyOptional({ example: 'Kathmandu, Nepal', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pickupAddress?: string;

  @ApiPropertyOptional({ example: 'Patient has chest pain' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  assignedHospital?: string;
}
