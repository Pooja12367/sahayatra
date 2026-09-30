import { ConfigService } from '@nestjs/config';
import type { Auth } from 'better-auth';
import { MongoClient } from 'mongodb';
import nodemailer from 'nodemailer';

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
  const configuredUrl = (
    configService.get<string>('FRONTEND_URL') ??
    configService.get<string>('APP_FRONTEND_URL')
  )?.trim();

  if (!configuredUrl) {
    throw new Error('FRONTEND_URL is required to send password reset links.');
  }

  let frontendUrl: URL;
  try {
    frontendUrl = new URL(configuredUrl);
  } catch {
    throw new Error('FRONTEND_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
    throw new Error('FRONTEND_URL must use HTTP or HTTPS.');
  }

  return frontendUrl.toString().replace(/\/$/, '');
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
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    try {
      const result = await transporter.sendMail({
        from: smtpFrom,
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
  const databaseName = configService.get<string>('MONGODB_DB_NAME');
  const configuredExpiry = Number(
    configService.get<string>('RESET_PASSWORD_TOKEN_EXPIRES_IN') ?? 3600,
  );
  const resetPasswordTokenExpiresIn =
    Number.isFinite(configuredExpiry) && configuredExpiry > 0
      ? configuredExpiry
      : 3600;
  const frontendUrl = getFrontendUrl(configService);

  return {
    secret: configService.get<string>('BETTER_AUTH_SECRET'),
    baseURL: configService.get<string>('BETTER_AUTH_URL'),
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
