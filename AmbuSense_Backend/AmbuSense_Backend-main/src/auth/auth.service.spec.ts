import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '../constants/enums';
import { AuthService } from './auth.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { SignupDto } from './dto/signup.dto';

describe('AuthService default admin bootstrap', () => {
  it('reads configured admin credentials from environment values', () => {
    const config = {
      get: (key: string) => ({
        ADMIN_FULL_NAME: 'System Admin',
        ADMIN_EMAIL: 'admin@ambusense.com',
        ADMIN_PHONE: '+9779800000000',
        ADMIN_PASSWORD: 'Admin@12345',
      })[key],
    } as ConfigService;

    expect(AuthService.resolveDefaultAdminConfig(config)).toEqual({
      fullName: 'System Admin',
      email: 'admin@ambusense.com',
      phone: '+9779800000000',
      password: 'Admin@12345',
    });
  });
});

describe('SignupDto validation', () => {
  it('accepts valid patient signup values', async () => {
    const dto = plainToInstance(SignupDto, {
      fullName: 'Sita Tamang',
      email: 'SITA@GMAIL.COM',
      phone: '+9779841234567',
      password: 'Sita123!',
      role: UserRole.PATIENT,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('sita@gmail.com');
  });

  it('normalizes international access-prefix phone numbers before signup', async () => {
    const dto = plainToInstance(SignupDto, {
      fullName: 'Sita Tamang',
      email: 'sita@example.com',
      phone: '009779841234567',
      password: 'Sita123!',
      role: UserRole.PATIENT,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.phone).toBe('+9779841234567');
  });

  it('rejects invalid role and poor password quality', async () => {
    const dto = new SignupDto();
    dto.fullName = 'Sita Tamang';
    dto.email = 'sita@example.com';
    dto.phone = '+9779841234567';
    dto.password = 'password';
    dto.role = 'admin' as UserRole;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'role')).toBe(true);
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('continues to accept public driver signup', async () => {
    const dto = new SignupDto();
    dto.fullName = 'Sita Tamang';
    dto.email = 'sita@example.com';
    dto.phone = '+9779841234567';
    dto.password = 'Sita123!';
    dto.role = UserRole.DRIVER;

    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('CreateStaffUserDto validation', () => {
  it.each([UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER])(
    'accepts staff role %s',
    async (role) => {
      const dto = Object.assign(new CreateStaffUserDto(), {
        fullName: 'Sita Tamang',
        email: 'sita@example.com',
        phone: '+9779841234567',
        password: 'Sita123!',
        role,
      });

      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it('rejects patient role and invalid staff request data', async () => {
    const dto = Object.assign(new CreateStaffUserDto(), {
      fullName: 'Sita Tamang',
      email: 'invalid-email',
      phone: '',
      password: 'weak',
      role: UserRole.PATIENT,
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['email', 'phone', 'password', 'role']),
    );
  });
});
