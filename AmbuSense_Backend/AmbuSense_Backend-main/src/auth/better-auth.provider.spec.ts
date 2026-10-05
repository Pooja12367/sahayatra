import { ConfigService } from '@nestjs/config';
import {
  buildResetPasswordEmailUrl,
  getConfiguredUrl,
  getResetPasswordRedirectUrl,
  redactResetPasswordToken,
} from './better-auth.provider';

function createConfig(values: Record<string, string>) {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('password reset URL configuration', () => {
  it('sends the Better Auth reset callback to the configured frontend reset page', () => {
    const frontendUrl = 'https://sahayatraa-three.vercel.app';
    const redirectTo = getResetPasswordRedirectUrl(frontendUrl);
    const betterAuthUrl = `https://sahayatra-backend-fa4y.onrender.com/reset-password/opaque-token?callbackURL=${encodeURIComponent(redirectTo)}`;
    const emailUrl = buildResetPasswordEmailUrl(
      betterAuthUrl,
      'opaque-token',
      frontendUrl,
    );

    expect(emailUrl).toBe(
      'https://sahayatraa-three.vercel.app/reset-password?token=opaque-token',
    );
    expect(redactResetPasswordToken(emailUrl)).toBe(
      'https://sahayatraa-three.vercel.app/reset-password?token=%5Bredacted%5D',
    );
    expect(emailUrl).not.toContain('localhost');
  });

  it('rejects reset callbacks outside the configured frontend', () => {
    const betterAuthUrl =
      'https://sahayatra-backend-fa4y.onrender.com/reset-password/token?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Freset-password';

    expect(() =>
      buildResetPasswordEmailUrl(
        betterAuthUrl,
        'token',
        'https://sahayatraa-three.vercel.app',
      ),
    ).toThrow('Password reset callback URL is not the configured frontend.');
  });

  it.each([
    'http://localhost:3000',
    'https://frontend.example.com:3000',
    'https://backend.example.com:5001',
  ])('rejects non-production URL configuration: %s', (url) => {
    const config = createConfig({
      NODE_ENV: 'production',
      FRONTEND_URL: url,
    });

    expect(() =>
      getConfiguredUrl(config, ['FRONTEND_URL'], 'frontend'),
    ).toThrow();
  });

  it('requires a frontend URL in production', () => {
    const config = createConfig({ NODE_ENV: 'production' });

    expect(() =>
      getConfiguredUrl(config, ['FRONTEND_URL'], 'frontend'),
    ).toThrow('FRONTEND_URL is required in production');
  });

  it('uses the configured deployed backend origin in production', () => {
    const config = createConfig({
      NODE_ENV: 'production',
      BETTER_AUTH_URL: 'http://localhost:5001',
    });

    expect(() =>
      getConfiguredUrl(config, ['BETTER_AUTH_URL'], 'backend'),
    ).toThrow();

    expect(
      getConfiguredUrl(
        createConfig({
          NODE_ENV: 'production',
          BETTER_AUTH_URL: 'https://sahayatra-backend-fa4y.onrender.com',
        }),
        ['BETTER_AUTH_URL'],
        'backend',
      ),
    ).toBe('https://sahayatra-backend-fa4y.onrender.com');
  });

  it('treats a Render deployment as production even without NODE_ENV', () => {
    const config = createConfig({
      RENDER_SERVICE_ID: 'render-service',
      FRONTEND_URL: 'http://localhost:3000',
    });

    expect(() =>
      getConfiguredUrl(config, ['FRONTEND_URL'], 'frontend'),
    ).toThrow();
  });
});
