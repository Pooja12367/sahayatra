import { IsEmail, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'aarav.patient@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    example: 'https://sahayatraa-three.vercel.app/reset-password',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  redirectTo?: string;
}
