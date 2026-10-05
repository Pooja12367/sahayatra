import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  IsBoolean,
  IsNumber,
  IsMongoId,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmbulanceStatus } from '../../constants/enums';

export class CreateAmbulanceDto {
  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  driverId?: string;

  @ApiProperty({ example: 'AMB-102' })
  @IsString()
  @IsNotEmpty()
  ambulanceCode!: string;

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
    enum: AmbulanceStatus,
    example: AmbulanceStatus.OFFLINE,
  })
  @IsOptional()
  @IsEnum(AmbulanceStatus)
  status?: AmbulanceStatus;

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

  @ApiPropertyOptional({ example: 'Kathmandu, Nepal', maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  locationName?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
