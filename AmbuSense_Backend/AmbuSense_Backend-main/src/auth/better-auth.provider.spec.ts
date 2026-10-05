import { ConfigService } from '@nestjs/config';
import {
  buildResetPasswordUrl,
  getConfiguredUrl,
} from './better-auth.provider';

function createConfig(values: Record<string, string>) {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('password reset URL configuration', () => {
  it('generates a reset link on the configured deployed frontend', () => {
    const config = createConfig({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://ambu-sense-frontend.vercel.app',
    });
    const frontendUrl = getConfiguredUrl(
      config,
      ['FRONTEND_URL'],
      'frontend',
    );

    expect(
      buildResetPasswordUrl(frontendUrl, 'token with reserved characters'),
    ).toBe(
      'https://ambu-sense-frontend.vercel.app/reset-password?token=token+with+reserved+characters',
    );
  });

  it.each([
    'http://localhost:3000',
    'https://frontend.example.com:3000',
    'https://backend.example.com:5001',
    'https://ambusense-frontend.vercel.app',
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

  it('requires the deployed backend origin in production', () => {
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
          BETTER_AUTH_URL: 'https://ambusense-backend.onrender.com',
        }),
        ['BETTER_AUTH_URL'],
        'backend',
      ),
    ).toBe('https://ambusense-backend.onrender.com');
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
