import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmbulanceStatus } from '../../constants/enums';

export class CreateAmbulanceDto {
  @ApiProperty({ example: 'AMB-102' })
  @IsString()
  @IsNotEmpty()
  ambulanceCode!: string;

  @ApiProperty({ example: 'Nabin KC' })
  @IsString()
  @IsNotEmpty()
  driverName!: string;

  @ApiProperty({ example: '+9779800000102' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

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
  coordinates!: [number, number];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
