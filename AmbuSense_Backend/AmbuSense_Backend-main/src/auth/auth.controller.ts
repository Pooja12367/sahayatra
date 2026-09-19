import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { UserDocument } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { SignupDto } from './dto/signup.dto';
import { UserRole } from '../constants/enums';
import { authExamples } from '../swagger/api-examples';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a patient account' })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 201,
    description: 'Patient account created and session cookie returned.',
    schema: { example: authExamples },
  })
  @ApiResponse({ status: 400, description: 'Invalid signup payload.' })
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signup(dto, req, res);
  }

  @Post('staff')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Create a staff account' })
  @ApiBody({
    type: SignupDto,
    examples: {
      dispatcher: {
        summary: 'Dispatcher account',
        value: {
          fullName: 'Dispatch Officer',
          email: 'dispatcher@example.com',
          phone: '+9779800000303',
          password: 'StrongPass123',
          role: UserRole.DISPATCHER,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Staff account created.',
    schema: {
      example: {
        user: { ...authExamples.user, role: UserRole.DISPATCHER },
        profile: authExamples.profile,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  async createStaff(@Body() dto: SignupDto, @Req() req: Request) {
    return this.authService.createStaff(dto, req);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful and session cookie returned.',
    schema: { example: authExamples },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, req, res);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send a password reset link' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset link will be sent.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, req);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using an email token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto, req);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear session cookie' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful and session cookie cleared.',
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.logout(req, res);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user and matching role profile.',
    schema: { example: authExamples },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  async me(@CurrentUser() user: UserDocument | undefined) {
    return this.authService.me(user);
  }
}
