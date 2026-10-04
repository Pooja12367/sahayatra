import { isIP } from 'node:net';

export function isLocalOrPrivateHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host.endsWith('.home.arpa') ||
    host.endsWith('.localdomain') ||
    host.endsWith('.test') ||
    !host.includes('.')
  ) {
    return true;
  }

  if (isIP(host) === 4) {
    const octets = host.split('.').map(Number);
    const [first, second] = octets;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first >= 224
    );
  }

  if (isIP(host) === 6) {
    return (
      host === '::' ||
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      /^fe[89ab]/.test(host) ||
      host.startsWith('::ffff:')
    );
  }

  return false;
}

export function validatePublicUrl(
  value: string,
  variableName: string,
  isProduction: boolean,
) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL.`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${variableName} must use HTTP or HTTPS.`);
  }

  if (url.username || url.password) {
    throw new Error(`${variableName} must not contain credentials.`);
  }

  if (url.search || url.hash) {
    throw new Error(`${variableName} must not contain a query or fragment.`);
  }

  if (
    isProduction &&
    (url.protocol !== 'https:' || isLocalOrPrivateHost(url.hostname))
  ) {
    throw new Error(
      `${variableName} must be a public HTTPS URL in production; localhost and private network hosts are not allowed.`,
    );
  }

  return url;
}
