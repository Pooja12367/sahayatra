import { ConfigService } from '@nestjs/config';
import type { Auth } from 'better-auth';
import { MongoClient } from 'mongodb';
import nodemailer from 'nodemailer';
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
  if (!localPart || !domain) return '[invalid-email]';
  return `${localPart.slice(0, 1)}***@${domain}`;
}

async function sendResetPasswordEmail(
  configService: ConfigService,
  data: ResetPasswordEmailData,
) {
  const smtpHost = configService.get<string>('SMTP_HOST');
  const smtpPort = Number(configService.get<string>('SMTP_PORT') ?? 587);
  const smtpUser = configService.get<string>('SMTP_USER');
  const smtpPassword = configService.get<string>('SMTP_PASSWORD');
  const smtpFrom = configService.get<string>('SMTP_FROM');

  console.log(
    `[auth] Password reset email sending attempted for ${maskEmail(data.email)}`,
  );

  if (smtpHost && smtpUser && smtpPassword && smtpFrom) {
    if (!Number.isInteger(smtpPort) || smtpPort <= 0) {
      throw new Error('SMTP_PORT must be a positive integer.');
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort === 587,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    try {
      const result = await transporter.sendMail({
        from: smtpFrom,
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
      });

      console.log(
        `[auth] Password reset email sent successfully for ${maskEmail(data.email)} (${result.messageId})`,
      );
      return;
    } catch (error) {
      console.error(
        `[auth] Password reset email failed for ${maskEmail(data.email)}: ${error instanceof Error ? error.message : 'unknown SMTP error'}`,
      );
      throw new Error('Password reset email could not be sent.');
    }
  }

  const resendApiKey = configService.get<string>('RESEND_API_KEY');
  const fromEmail =
    configService.get<string>('PASSWORD_RESET_FROM_EMAIL') ??
    configService.get<string>('RESEND_FROM_EMAIL');

  if (resendApiKey && fromEmail) {
    const response = await fetch('https://api.resend.com/emails', {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[auth] Password reset email failed for ${maskEmail(data.email)} via Resend: ${response.status}`,
      );
      throw new Error(`Failed to send password reset email: ${errorText}`);
    }

    console.log(
      `[auth] Password reset email sent successfully for ${maskEmail(data.email)} via Resend`,
    );
    return;
  }

  console.error(
    `[auth] Password reset email failed for ${maskEmail(data.email)}: SMTP configuration is incomplete`,
  );
  throw new Error(
    'Password reset email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.',
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
    database: mongodbAdapter(client.db(databaseName), {
      client,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn,
      sendResetPassword: async ({ user, token }) => {
        console.log(
          `[auth] Password reset token generated for ${maskEmail(user.email)}`,
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
