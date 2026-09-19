import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelEmergencyRequestDto {
  @ApiPropertyOptional({ example: 'Patient cancelled the request' })
  @IsOptional()
  @IsString()
  reason?: string;
}
