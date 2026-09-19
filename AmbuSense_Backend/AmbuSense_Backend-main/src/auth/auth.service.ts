import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response as ExpressResponse } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { Types } from 'mongoose';
import { UserRole } from '../constants/enums';
import { RoleProfilesService } from '../role-profiles/role-profiles.service';
import { UserDocument } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AmbuSenseAuth, createBetterAuth } from './better-auth.provider';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';

type AuthUserPayload = {
  id: string;
};

type BetterAuthUserRecord = {
  _id: string | ObjectId;
};

type MongoDuplicateKeyError = {
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
};

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private auth?: AmbuSenseAuth;
  private mongoClient?: MongoClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly roleProfilesService: RoleProfilesService,
  ) {}

  async onModuleInit() {
    const { auth, client } = await createBetterAuth(this.configService);
    this.auth = auth;
    this.mongoClient = client;
  }

  async onModuleDestroy() {
    await this.mongoClient?.close();
  }

  async signup(dto: SignupDto, req: Request, res: ExpressResponse) {
    if (![UserRole.PATIENT, UserRole.DRIVER].includes(dto.role)) {
      throw new BadRequestException(
        'Public signup is only available for patients and drivers',
      );
    }

    return this.createUserWithProfile(dto, req, res, true);
  }

  async createStaff(dto: SignupDto, req: Request) {
    if (dto.role === UserRole.PATIENT) {
      throw new BadRequestException(
        'Use public signup to create patient users',
      );
    }

    return this.createUserWithProfile(dto, req, undefined, false);
  }

  private async createUserWithProfile(
    dto: SignupDto,
    req: Request,
    res: ExpressResponse | undefined,
    copyCookies: boolean,
  ) {
    await this.assertUserIsUnique(dto);

    let authResponse: Response;
    try {
      authResponse = await this.getAuth().api.signUpEmail({
        body: {
          name: dto.fullName,
          email: dto.email,
          password: dto.password,
          phone: dto.phone,
          role: dto.role,
        },
        headers: this.headersFromRequest(req, copyCookies),
        asResponse: true,
      } as never);
    } catch (error) {
      this.handleDuplicateUserError(error);
      throw error;
    }
    const payload = await this.readAuthResponse(authResponse);

    this.assertAuthResponseOk(authResponse, payload);

    const authUser = this.getAuthUserPayload(payload);
    const { user, profile } = await this.createSignupProfile(authUser.id);

    if (copyCookies && res) {
      this.copyAuthHeaders(authResponse, res);
    }

    return {
      user: this.usersService.sanitize(user),
      profile,
    };
  }

  async login(dto: LoginDto, req: Request, res: ExpressResponse) {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser && !existingUser.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    const authResponse = await this.getAuth().api.signInEmail({
      body: {
        email: dto.email,
        password: dto.password,
        rememberMe: dto.rememberMe,
      },
      headers: this.headersFromRequest(req),
      asResponse: true,
    } as never);
    const payload = await this.readAuthResponse(authResponse);

    this.assertAuthResponseOk(authResponse, payload);

    const authUser = this.getAuthUserPayload(payload);
    const user = await this.usersService.updateLastLoginAt(authUser.id);
    const profile = await this.roleProfilesService.findByUser(
      user.role as UserRole,
      user._id as Types.ObjectId,
    );

    this.copyAuthHeaders(authResponse, res);

    return {
      user: this.usersService.sanitize(user),
      profile,
    };
  }

  async logout(req: Request, res: ExpressResponse) {
    const authResponse = await this.getAuth().api.signOut({
      headers: this.headersFromRequest(req),
      asResponse: true,
    } as never);

    this.copyAuthHeaders(authResponse, res);
  }

  async forgotPassword(dto: ForgotPasswordDto, req: Request) {
    const authResponse = await this.getAuth().api.requestPasswordReset({
      body: {
        email: dto.email,
      },
      headers: this.headersFromRequest(req),
      asResponse: true,
    } as never);
    const payload = await this.readAuthResponse(authResponse);

    this.assertAuthResponseOk(authResponse, payload);

    return {
      message:
        'If this email exists in our system, check your email for the reset link.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, req: Request) {
    const authResponse = await this.getAuth().api.resetPassword({
      body: {
        token: dto.token,
        newPassword: dto.newPassword,
      },
      headers: this.headersFromRequest(req),
      asResponse: true,
    } as never);
    const payload = await this.readAuthResponse(authResponse);

    this.assertAuthResponseOk(authResponse, payload);

    return {
      message: 'Password reset successfully.',
    };
  }

  async me(user: UserDocument | undefined) {
    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    const profile = await this.roleProfilesService.findByUser(
      user.role as UserRole,
      user._id as Types.ObjectId,
    );

    return {
      user: this.usersService.sanitize(user),
      profile,
    };
  }

  async getCurrentUser(req: Request): Promise<UserDocument> {
    const session = await this.getAuth().api.getSession({
      headers: this.headersFromRequest(req),
    });

    if (!session?.user?.id) {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = await this.usersService.requireById(session.user.id);

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }

    return user;
  }

  private async createSignupProfile(authUserId: string) {
    try {
      const user = await this.usersService.requireById(authUserId);
      const profile = await this.roleProfilesService.createForRole(
        user.role as UserRole,
        user._id as Types.ObjectId,
      );

      return { user, profile };
    } catch (error) {
      try {
        await this.cleanupAuthUser(authUserId);
      } catch (cleanupError) {
        throw new InternalServerErrorException(
          'Signup failed and auth cleanup did not complete',
          { cause: cleanupError },
        );
      }

      throw new InternalServerErrorException(
        'Signup failed while creating role profile',
        { cause: error },
      );
    }
  }

  private async assertUserIsUnique(dto: SignupDto) {
    const [emailUser, phoneUser] = await Promise.all([
      this.usersService.findByEmail(dto.email),
      this.usersService.findByPhone(dto.phone),
    ]);

    if (emailUser) {
      throw new ConflictException('A user with this email already exists');
    }

    if (phoneUser) {
      throw new ConflictException('A user with this phone already exists');
    }
  }

  private handleDuplicateUserError(error: unknown): never | void {
    if (!this.isMongoDuplicateKeyError(error)) {
      return;
    }

    const duplicateField = Object.keys(error.keyPattern ?? {})[0];

    if (duplicateField === 'email') {
      throw new ConflictException('A user with this email already exists');
    }

    if (duplicateField === 'phone') {
      throw new ConflictException('A user with this phone already exists');
    }

    throw new ConflictException('A user with these details already exists');
  }

  private isMongoDuplicateKeyError(
    error: unknown,
  ): error is MongoDuplicateKeyError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as MongoDuplicateKeyError).code === 11000
    );
  }

  private async cleanupAuthUser(authUserId: string) {
    if (!this.mongoClient) {
      return;
    }

    const databaseName = this.configService.get<string>('MONGODB_DB_NAME');
    const db = this.mongoClient.db(databaseName);
    const userId = ObjectId.isValid(authUserId)
      ? new ObjectId(authUserId)
      : authUserId;

    await Promise.all([
      db.collection('session').deleteMany({ userId }),
      db.collection('account').deleteMany({ userId }),
      db.collection<BetterAuthUserRecord>('users').deleteOne({ _id: userId }),
    ]);
  }

  private getAuth(): AmbuSenseAuth {
    if (!this.auth) {
      throw new Error('Better Auth has not been initialized');
    }

    return this.auth;
  }

  private headersFromRequest(req: Request, includeCookies = true): Headers {
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (!includeCookies && key.toLowerCase() === 'cookie') {
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => headers.append(key, item));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    return headers;
  }

  private copyAuthHeaders(authResponse: Response, res: ExpressResponse) {
    const getSetCookie = (
      authResponse.headers as Headers & {
        getSetCookie?: () => string[];
      }
    ).getSetCookie;
    const cookies = getSetCookie
      ? getSetCookie.call(authResponse.headers)
      : authResponse.headers.get('set-cookie')
        ? [authResponse.headers.get('set-cookie') as string]
        : [];

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    for (const cookie of cookies) {
      const normalizedCookie = isProduction
        ? cookie
            .replace(/SameSite=Lax/gi, 'SameSite=None')
            .replace(/SameSite=Strict/gi, 'SameSite=None')
        : cookie;

      res.append('Set-Cookie', normalizedCookie);
    }
  }

  private async readAuthResponse(authResponse: Response) {
    const text = await authResponse.text();

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private getAuthUserPayload(
    payload: Record<string, unknown>,
  ): AuthUserPayload {
    const user = payload.user as Partial<AuthUserPayload> | undefined;

    if (!user?.id) {
      throw new UnauthorizedException('Authentication failed');
    }

    return { id: user.id };
  }

  private assertAuthResponseOk(
    authResponse: Response,
    payload: Record<string, unknown>,
  ) {
    if (authResponse.ok) {
      return;
    }

    const message =
      typeof payload.message === 'string'
        ? payload.message
        : 'Authentication failed';

    throw new HttpException(message, authResponse.status);
  }
}

