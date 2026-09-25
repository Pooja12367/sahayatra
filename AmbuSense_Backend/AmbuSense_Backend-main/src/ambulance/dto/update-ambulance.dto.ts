import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAmbulanceDto {
  @ApiPropertyOptional({ example: 'AMB-102' })
  @IsOptional()
  @IsString()
  ambulanceCode?: string;

  @ApiPropertyOptional({ example: 'Nabin KC' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ example: '9817404665' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^[0-9]{10}$/, {
    message: 'Phone number must be exactly 10 digits',
  })
  phone?: string;

  @ApiPropertyOptional({
    enum: ['available', 'on-duty', 'busy', 'offline'],
    example: 'available',
  })
  @IsOptional()
  @IsEnum(['available', 'on-duty', 'busy', 'offline'])
  status?: 'available' | 'on-duty' | 'busy' | 'offline';

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
}
