import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignEmergencyRequestDto {
  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5680' })
  @IsOptional()
  @IsMongoId()
  ambulanceId?: string;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  hospitalId?: string;

  @ApiPropertyOptional({ example: 'Assigning nearest available ambulance' })
  @IsOptional()
  @IsString()
  notes?: string;
}
