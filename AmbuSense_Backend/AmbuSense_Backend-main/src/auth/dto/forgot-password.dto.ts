import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'aarav.patient@example.com' })
  @IsEmail()
  email!: string;
}
