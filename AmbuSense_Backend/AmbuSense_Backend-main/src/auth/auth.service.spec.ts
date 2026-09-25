import { ConfigService } from '@nestjs/config';
import { validate } from 'class-validator';
import { UserRole } from '../constants/enums';
import { AuthService } from './auth.service';
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
    const dto = new SignupDto();
    dto.fullName = 'Sita Tamang';
    dto.email = 'SITA@GMAIL.COM';
    dto.phone = '+9779841234567';
    dto.password = 'Sita123!';
    dto.role = UserRole.PATIENT;

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('sita@gmail.com');
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
});
