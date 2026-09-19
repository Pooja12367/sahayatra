import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AmbulanceStatus } from '../../constants/enums';

export class UpdateAmbulanceStatusDto {
  @ApiProperty({ enum: AmbulanceStatus, example: AmbulanceStatus.AVAILABLE })
  @IsEnum(AmbulanceStatus)
  status!: AmbulanceStatus;
}
