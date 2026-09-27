import { OmitType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { UserRole } from '../../constants/enums';
import { SignupDto } from './signup.dto';

export class CreateStaffUserDto extends OmitType(SignupDto, ['role'] as const) {
  @ApiProperty({
    enum: [UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER],
    example: UserRole.DISPATCHER,
  })
  @IsIn([UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER], {
    message: 'Staff role must be admin, dispatcher, or driver.',
  })
  role!: UserRole;
}