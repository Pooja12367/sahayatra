import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHospitalDto {
  @ApiProperty({ example: 'City Care Hospital' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '+977014411111' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'New Baneshwor, Kathmandu' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiPropertyOptional({
    enum: ['available', 'busy', 'offline'],
    example: 'available',
  })
  @IsOptional()
  @IsEnum(['available', 'busy', 'offline'])
  status?: 'available' | 'busy' | 'offline';

  @ApiProperty({ example: 120, minimum: 0 })
  @IsInt()
  @Min(0)
  capacity!: number;

  @ApiProperty({ example: 18, minimum: 0 })
  @IsInt()
  @Min(0)
  availableBeds!: number;

  @ApiPropertyOptional({ example: ['Trauma', 'Emergency'], type: [String] })
  @IsOptional()
  @IsArray()
  specialization?: string[];

  @ApiProperty({
    example: [85.3431, 27.6908],
    minItems: 2,
    maxItems: 2,
    description: '[longitude, latitude]',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  coordinates!: [number, number];
}
