import { isLocalOrPrivateHost, validatePublicUrl } from './public-url';

describe('public URL validation', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '192.168.1.20',
    '10.0.0.12',
    '172.16.0.3',
    'my-laptop.local',
    'service.internal',
  ])('identifies local/private host %s', (hostname) => {
    expect(isLocalOrPrivateHost(hostname)).toBe(true);
  });

  it('allows a deployed HTTPS host in production', () => {
    expect(
      validatePublicUrl('https://app.example.com', 'FRONTEND_URL', true).origin,
    ).toBe('https://app.example.com');
  });

  it.each([
    'http://app.example.com',
    'https://localhost',
    'https://192.168.1.20',
  ])('rejects non-public production URL %s', (value) => {
    expect(() => validatePublicUrl(value, 'FRONTEND_URL', true)).toThrow(
      'must be a public HTTPS URL in production',
    );
  });

  it('keeps localhost available in development', () => {
    expect(
      validatePublicUrl('http://localhost:3000', 'FRONTEND_URL', false).origin,
    ).toBe('http://localhost:3000');
  });
});
