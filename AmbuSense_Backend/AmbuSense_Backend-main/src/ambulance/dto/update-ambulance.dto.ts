import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAmbulanceDto {
  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  driverId?: string;

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

  @ApiPropertyOptional({ example: 'Kathmandu, Nepal', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationName?: string;
}
