import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HospitalAssignmentTechnique } from '../../constants/enums';

export class DispatchEmergencyRequestDto {
  @ApiProperty({
    enum: HospitalAssignmentTechnique,
    example: HospitalAssignmentTechnique.SYSTEM_AUTO,
  })
  @IsEnum(HospitalAssignmentTechnique)
  hospitalAssignmentTechnique!: HospitalAssignmentTechnique;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5680' })
  @IsOptional()
  @IsMongoId()
  ambulanceId?: string;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  hospitalId?: string;

  @ApiPropertyOptional({ example: 'Dispatching to selected hospital' })
  @IsOptional()
  @IsString()
  notes?: string;
}
