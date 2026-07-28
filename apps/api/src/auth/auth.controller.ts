// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  LoginResponseDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '@fstail/types';

function setCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  isProd: boolean,
) {
  const common = {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };

  res.cookie('accessToken', tokens.accessToken, {
    ...common,
    maxAge: 15 * 60 * 1000, // 15 min
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    ...common,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
  });
}

function clearCookies(res: Response, isProd: boolean) {
  const common = {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
  res.clearCookie('accessToken', common);
  res.clearCookie('refreshToken', common);
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    this.isProd = this.config.get('NODE_ENV') === 'production';
  }

  // ── POST /auth/login ───────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // 10 attempts / min
  @ApiOperation({ summary: 'Login — sets HttpOnly JWT cookies' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account locked' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const { tokens, user } = await this.authService.login(dto.email, dto.password);
    setCookies(res, tokens, this.isProd);
    return { message: 'Logged in successfully', user };
  }

  // ── POST /auth/register ────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 5 registrations / min
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'Account created — verification email sent' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    const { user } = await this.authService.register(dto);
    return {
      message: 'Account created. Check your email to verify your address.',
      user,
    };
  }

  // ── POST /auth/refresh ─────────────────────────────────────────────

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token — issues new token pair' })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({ status: 200, description: 'New cookies issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request & { user: AuthUser & { refreshTokenId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id, email, role, refreshTokenId } = req.user;
    const tokens = await this.authService.refresh(id, email, role, refreshTokenId);
    setCookies(res, tokens, this.isProd);
    return { message: 'Token refreshed' };
  }

  // ── POST /auth/logout ──────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout — clears cookies, revokes refresh token' })
  @ApiCookieAuth('accessToken')
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refreshToken'];
    await this.authService.logout(userId, refreshToken);
    clearCookies(res, this.isProd);
    return { message: 'Logged out' };
  }

  // ── POST /auth/logout-all ──────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all refresh tokens — log out all devices' })
  @ApiCookieAuth('accessToken')
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAllDevices(userId);
    clearCookies(res, this.isProd);
    return { message: 'Logged out from all devices' };
  }

  // ── GET /auth/me ───────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiCookieAuth('accessToken')
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getMe(@CurrentUser() user: AuthUser) {
    return user;
  }

  // ── POST /auth/verify-email ────────────────────────────────────────

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using token from email link' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully' };
  }

  // ── POST /auth/resend-verification ────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiCookieAuth('accessToken')
  async resendVerification(@CurrentUser('id') userId: string) {
    await this.authService.resendVerification(userId);
    return { message: 'Verification email sent' };
  }

  // ── POST /auth/forgot-password ────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'If the email exists, a reset link has been sent' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    // Always the same response — never reveal if email exists
    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  // ── POST /auth/reset-password ─────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Reset password using token from email link' })
  @ApiResponse({ status: 200, description: 'Password changed — all sessions revoked' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password changed. Please log in again.' };
  }
}
