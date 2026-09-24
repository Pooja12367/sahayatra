import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

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
