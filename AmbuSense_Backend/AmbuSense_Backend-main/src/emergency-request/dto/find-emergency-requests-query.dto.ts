import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  EmergencyRequestStatus,
  HospitalAssignmentTechnique,
} from '../../constants/enums';

export class FindEmergencyRequestsQueryDto {
  @ApiPropertyOptional({ example: 'Sita' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: EmergencyRequestStatus,
    example: EmergencyRequestStatus.ASSIGNED,
  })
  @IsOptional()
  @IsEnum(EmergencyRequestStatus)
  status?: EmergencyRequestStatus;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5680' })
  @IsOptional()
  @IsMongoId()
  assignedAmbulance?: string;

  @ApiPropertyOptional({ example: '65f1a6f2c3b7a91d2e4f5681' })
  @IsOptional()
  @IsMongoId()
  assignedHospital?: string;

  @ApiPropertyOptional({
    enum: HospitalAssignmentTechnique,
    example: HospitalAssignmentTechnique.SYSTEM_AUTO,
  })
  @IsOptional()
  @IsEnum(HospitalAssignmentTechnique)
  hospitalAssignmentTechnique?: HospitalAssignmentTechnique;
}
