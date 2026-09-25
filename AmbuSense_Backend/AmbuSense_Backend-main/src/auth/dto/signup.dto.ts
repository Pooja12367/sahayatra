import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../constants/enums';

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const compact = value.trim().replace(/[\s-]+/g, '');
  if (!compact) {
    return '';
  }

  let digits = compact.replace(/\D/g, '');

  if (compact.startsWith('+977')) {
    digits = compact.slice(4).replace(/\D/g, '');
  } else if (compact.startsWith('977')) {
    digits = compact.slice(3).replace(/\D/g, '');
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (!/^9\d{9}$/.test(digits)) {
    return '';
  }

  if (/^(\d)\1{9}$/.test(digits)) {
    return '';
  }

  return `+977${digits}`;
}

export class SignupDto {
  @ApiProperty({ example: 'Aarav Sharma' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value,
  )
  @IsString()
  @Length(2, 100, { message: 'Full name must be 2 to 100 characters long.' })
  @Matches(/^(?=.*[\p{L}])[\p{L}\p{M}\s.'-]{2,100}$/u, {
    message:
      'Full name must contain meaningful letters and may include spaces, apostrophes, or hyphens.',
  })
  fullName!: string;

  @ApiProperty({ example: 'aarav.patient@example.com' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsString()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Email is too long.' })
  email!: string;

  @ApiProperty({ example: '+9779800000001' })
  @Transform(({ value }) => normalizePhone(value))
  @IsString({ message: 'Phone number is required.' })
  @Matches(/^\+9779\d{9}$/, {
    message:
      'Enter a valid Nepal mobile number, for example +9779841234567.',
  })
  phone!: string;

  @ApiProperty({ example: 'StrongPass123!', minLength: 8 })
  @IsString({ message: 'Password is required.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long.' })
  @Matches(/^(?!\s)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S.*\S$|^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/, {
    message:
      'Password must include uppercase, lowercase, a number, and a special character, and must not start or end with whitespace.',
  })
  password!: string;

  @ApiProperty({ enum: [UserRole.PATIENT, UserRole.DRIVER], example: UserRole.PATIENT })
  @IsIn([UserRole.PATIENT, UserRole.DRIVER], {
    message: 'Public signup is only available for patients and drivers.',
  })
  role!: UserRole;
}
