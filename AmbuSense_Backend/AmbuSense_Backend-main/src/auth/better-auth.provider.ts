import { ConfigService } from '@nestjs/config';
import type { Auth } from 'better-auth';
import { MongoClient } from 'mongodb';
import { isLocalOrPrivateHost, validatePublicUrl } from '../config/public-url';

type BetterAuthModule = typeof import('better-auth');
type MongoAdapterModule = typeof import('@better-auth/mongo-adapter');
type MongodbAdapter = MongoAdapterModule['mongodbAdapter'];

type ResetPasswordEmailData = {
  email: string;
  name?: string;
  resetUrl: string;
};

const dynamicImport = new Function('specifier', 'return import(specifier)') as <
  TModule,
>(
  specifier: string,
) => Promise<TModule>;

export type SahayatraAuth = Auth<ReturnType<typeof getBetterAuthOptions>>;

function getConfiguredUrl(
  configService: ConfigService,
  names: string[],
  kind: 'frontend' | 'backend',
) {
  const isProduction =
    (configService.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development') === 'production';

  const configuredUrl = (isProduction ? [names[0]] : names)
    .map((name) => configService.get<string>(name))
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim();

  if (!configuredUrl) {
    if (!isProduction) {
      const fallback =
        kind === 'frontend' ? 'http://localhost:3000' : 'http://localhost:5002';
      return fallback;
    }

    throw new Error(
      `${names[0]} is required in production so password reset links and auth callbacks point to the deployed application.`,
    );
  }

  const parsedUrl = validatePublicUrl(configuredUrl, names[0], isProduction);
  return parsedUrl.toString().replace(/\/$/, '');
}

function getFrontendUrl(configService: ConfigService) {
  return getConfiguredUrl(
    configService,
    ['FRONTEND_URL', 'APP_FRONTEND_URL', 'PUBLIC_FRONTEND_URL'],
    'frontend',
  );
}

function getBackendUrl(configService: ConfigService) {
  return getConfiguredUrl(
    configService,
    ['BETTER_AUTH_URL', 'APP_BACKEND_URL', 'PUBLIC_BACKEND_URL'],
    'backend',
  );
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '[redacted-email]';
  return `${localPart.slice(0, 1)}***@${domain}`;
}

function sanitizeProviderMessage(message: string, secrets: string[]) {
  let sanitized = message;
  for (const secret of secrets) {
    if (secret) {
      sanitized = sanitized.replaceAll(secret, '[redacted]');
    }
  }

  return sanitized
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/(token=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 300);
}

async function sendResetPasswordEmail(
  configService: ConfigService,
  data: ResetPasswordEmailData,
) {
  const resendApiKey = configService.get<string>('RESEND_API_KEY')?.trim();
  const fromEmail =
    configService.get<string>('RESEND_FROM')?.trim() ||
    configService.get<string>('PASSWORD_RESET_FROM_EMAIL')?.trim() ||
    configService.get<string>('RESEND_FROM_EMAIL')?.trim();

  if (!resendApiKey || !fromEmail) {
    console.error(
      `[auth] Password reset email delivery is not configured for ${maskEmail(data.email)}`,
    );
    throw new Error(
      'Password reset email is not configured. Set RESEND_API_KEY and RESEND_FROM.',
    );
  }

  console.log(
    `[auth] Resend request attempted for password reset to ${maskEmail(data.email)}`,
  );

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: data.email,
        subject: 'Reset your Sahayatra password',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h2>Reset your Sahayatra password</h2>
            <p>Hello${data.name ? ` ${data.name}` : ''},</p>
            <p>Use the button below to create a new password. This link expires soon.</p>
            <p>
              <a href="${data.resetUrl}" style="display:inline-block;background:#059669;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none">
                Reset password
              </a>
            </p>
            <p>If the button does not work, paste this link into your browser:</p>
            <p style="word-break:break-all">${data.resetUrl}</p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
        text: `Reset your Sahayatra password: ${data.resetUrl}`,
      }),
    });
  } catch (error) {
    const errorCode =
      typeof error === 'object' &&
      error !== null &&
      'cause' in error &&
      typeof error.cause === 'object' &&
      error.cause !== null &&
      'code' in error.cause &&
      typeof error.cause.code === 'string' &&
      /^[A-Z0-9_]+$/.test(error.cause.code)
        ? error.cause.code
        : undefined;
    console.error(
      `[auth] Password reset email failed for ${maskEmail(data.email)} via Resend${
        errorCode ? ` (${errorCode})` : ''
      }`,
    );
    throw new Error('Password reset email could not be sent.');
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = undefined;
  }

  if (!response.ok) {
    const responseData =
      typeof responseBody === 'object' && responseBody !== null
        ? (responseBody as Record<string, unknown>)
        : {};
    const providerErrorName =
      typeof responseData.name === 'string'
        ? sanitizeProviderMessage(responseData.name, [
            resendApiKey,
            fromEmail,
            data.email,
            data.resetUrl,
          ])
        : undefined;
    const providerErrorMessage =
      typeof responseData.message === 'string'
        ? sanitizeProviderMessage(responseData.message, [
            resendApiKey,
            fromEmail,
            data.email,
            data.resetUrl,
          ])
        : undefined;
    console.error(
      `[auth] Resend rejected password reset email for ${maskEmail(data.email)}: HTTP ${response.status}${
        providerErrorName ? ` (${providerErrorName})` : ''
      }${providerErrorMessage ? ` ${providerErrorMessage}` : ''}`,
    );
    throw new Error('Password reset email could not be sent.');
  }

  const emailId =
    typeof responseBody === 'object' &&
    responseBody !== null &&
    'id' in responseBody &&
    typeof responseBody.id === 'string'
      ? responseBody.id
      : undefined;
  console.log(
    `[auth] Resend accepted password reset email for ${maskEmail(data.email)} (HTTP ${response.status})${
      emailId ? `, email ID ${emailId}` : ''
    }`,
  );
}

function getBetterAuthOptions(
  client: MongoClient,
  configService: ConfigService,
  mongodbAdapter: MongodbAdapter,
) {
  const databaseName = configService.get<string>('MONGODB_DB_NAME')?.trim();
  if (!databaseName) {
    throw new Error('MONGODB_DB_NAME is required for Better Auth.');
  }
  const configuredExpiry = Number(
    configService.get<string>('RESET_PASSWORD_TOKEN_EXPIRES_IN') ?? 3600,
  );
  if (!Number.isFinite(configuredExpiry) || configuredExpiry <= 0) {
    throw new Error(
      'RESET_PASSWORD_TOKEN_EXPIRES_IN must be a positive number.',
    );
  }
  const resetPasswordTokenExpiresIn = configuredExpiry;
  const frontendUrl = getFrontendUrl(configService);

  return {
    secret: configService.get<string>('BETTER_AUTH_SECRET'),
    baseURL: getBackendUrl(configService),
    logger: {
      log: (level, message, ...args) => {
        if (message === 'Reset Password: User not found') {
          console.error(
            '[Better Auth]: Reset Password user lookup did not match',
          );
          return;
        }

        if (level === 'error') {
          console.error(`[Better Auth]: ${message}`, ...args);
        } else if (level === 'warn') {
          console.warn(`[Better Auth]: ${message}`, ...args);
        } else if (level === 'debug') {
          console.debug(`[Better Auth]: ${message}`, ...args);
        } else {
          console.info(`[Better Auth]: ${message}`, ...args);
        }
      },
    },
    database: mongodbAdapter(client.db(databaseName), {
      client,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn,
      sendResetPassword: async ({ user, token }) => {
        console.log(
          `[auth] Password reset email callback invoked for ${maskEmail(user.email)}`,
        );
        const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(
          token,
        )}`;

        await sendResetPasswordEmail(configService, {
          email: user.email,
          name: user.name,
          resetUrl,
        });
      },
    },
    user: {
      modelName: 'users',
      fields: {
        name: 'fullName',
      },
      additionalFields: {
        phone: {
          type: 'string',
          required: true,
          unique: true,
          input: true,
        },
        role: {
          type: 'string',
          required: true,
          input: true,
        },
        isActive: {
          type: 'boolean',
          required: false,
          defaultValue: true,
          input: false,
        },
        lastLoginAt: {
          type: 'date',
          required: false,
          input: false,
        },
      },
    },
  } as const;
}

export async function createBetterAuth(
  configService: ConfigService,
): Promise<{ auth: SahayatraAuth; client: MongoClient }> {
  const uri = configService.get<string>('MONGODB_URI');
  const secret = configService.get<string>('BETTER_AUTH_SECRET');
  const isProduction =
    (configService.get<string>('NODE_ENV') ??
      process.env.NODE_ENV ??
      'development') === 'production';

  if (!uri) {
    throw new Error('MONGODB_URI is required for Better Auth');
  }

  if (isProduction) {
    let mongodbUrl: URL;
    try {
      mongodbUrl = new URL(uri);
    } catch {
      throw new Error('MONGODB_URI must be a valid MongoDB connection URL.');
    }

    if (
      !['mongodb:', 'mongodb+srv:'].includes(mongodbUrl.protocol) ||
      isLocalOrPrivateHost(mongodbUrl.hostname)
    ) {
      throw new Error(
        'MONGODB_URI must point to the production MongoDB service, not a local or private network host.',
      );
    }
  }

  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET is required for Better Auth');
  }

  const client = new MongoClient(uri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();

  const [{ betterAuth }, { mongodbAdapter }] = await Promise.all([
    dynamicImport<BetterAuthModule>('better-auth'),
    dynamicImport<MongoAdapterModule>('@better-auth/mongo-adapter'),
  ]);

  return {
    auth: betterAuth(
      getBetterAuthOptions(client, configService, mongodbAdapter),
    ),
    client,
  };
}
