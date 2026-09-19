import { IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
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

  @ApiPropertyOptional({ example: '+9779800000102' })
  @IsOptional()
  @IsString()
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
  coordinates?: [number, number];
}
