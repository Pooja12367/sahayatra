import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyDriverDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isVerified!: boolean;

  @ApiPropertyOptional({ example: 'License verified by admin' })
  @IsOptional()
  @IsString()
  verificationNote?: string;
}
