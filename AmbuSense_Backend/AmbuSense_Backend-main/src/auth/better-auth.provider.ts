import { ConfigService } from '@nestjs/config';
import type { Auth } from 'better-auth';
import { MongoClient } from 'mongodb';
import { UserRole } from '../constants/enums';

type BetterAuthModule = typeof import('better-auth');
type MongoAdapterModule = typeof import('@better-auth/mongo-adapter');
type MongodbAdapter = MongoAdapterModule['mongodbAdapter'];

type ResetPasswordEmailData = {
  email: string;
  name?: string;
  resetUrl: string;
};

const dynamicImport = new Function(
  'specifier',
  'return import(specifier)',
) as <TModule>(specifier: string) => Promise<TModule>;

export type AmbuSenseAuth = Auth<ReturnType<typeof getBetterAuthOptions>>;

function getFrontendUrl(configService: ConfigService) {
  return (
    configService.get<string>('FRONTEND_URL') ??
    configService.get<string>('APP_FRONTEND_URL') ??
    'https://ambu-sense-frontend.vercel.app'
  ).replace(/\/$/, '');
}

async function sendResetPasswordEmail(
  configService: ConfigService,
  data: ResetPasswordEmailData,
) {
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
        subject: 'Reset your AmbuSense password',
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h2>Reset your AmbuSense password</h2>
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
        text: `Reset your AmbuSense password: ${data.resetUrl}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send password reset email: ${errorText}`);
    }

    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Password reset email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
    );
  }

  console.warn(
    `[auth] Password reset link for ${data.email}: ${data.resetUrl}`,
  );
}

function getBetterAuthOptions(
  client: MongoClient,
  configService: ConfigService,
  mongodbAdapter: MongodbAdapter,
) {
  const databaseName = configService.get<string>('MONGODB_DB_NAME');

  return {
    secret: configService.get<string>('BETTER_AUTH_SECRET'),
    baseURL: configService.get<string>('BETTER_AUTH_URL'),
    database: mongodbAdapter(client.db(databaseName), {
      client,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn:
        configService.get<number>('RESET_PASSWORD_TOKEN_EXPIRES_IN') ?? 3600,
      sendResetPassword: async ({ user, token }) => {
        const frontendUrl = getFrontendUrl(configService);
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
          type: Object.values(UserRole),
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
): Promise<{ auth: AmbuSenseAuth; client: MongoClient }> {
  const uri = configService.get<string>('MONGODB_URI');
  const secret = configService.get<string>('BETTER_AUTH_SECRET');

  if (!uri) {
    throw new Error('MONGODB_URI is required for Better Auth');
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
    auth: betterAuth(getBetterAuthOptions(client, configService, mongodbAdapter)),
    client,
  };
}
