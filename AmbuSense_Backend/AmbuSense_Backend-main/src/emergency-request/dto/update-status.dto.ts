import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EmergencyRequestStatus } from '../../constants/enums';

export class UpdateStatusDto {
  @ApiProperty({
    enum: EmergencyRequestStatus,
    example: EmergencyRequestStatus.EN_ROUTE,
  })
  @IsEnum(EmergencyRequestStatus)
  status!: EmergencyRequestStatus;
}
