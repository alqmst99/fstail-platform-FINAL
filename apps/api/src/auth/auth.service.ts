// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EmailService } from './email.service';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import * as bcryptjs from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { RegisterDto } from './dto/auth.dto';
import type { AuthUser, TokenPair } from '@fstail/types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const BCRYPT_ROUNDS = 12;
const EMAIL_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;
const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<{ tokens: TokenPair; user: AuthUser }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      await bcryptjs.compare(password, '$2b$12$placeholder.hash.for.timing.safety');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(
        `Account locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      );
    }

    const passwordValid = await bcryptjs.compare(password, user.passwordHash);

    if (!passwordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        workspaceId: user.workspaceId,
      },
    };
  }

  // ── Register ───────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ user: AuthUser }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcryptjs.hash(dto.password, BCRYPT_ROUNDS);

    let workspaceId: string | null = null;
    if (dto.workspaceSlug) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { slug: dto.workspaceSlug },
      });
      if (!workspace) throw new NotFoundException(`Workspace '${dto.workspaceSlug}' not found`);
      workspaceId = workspace.id;
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.displayName,
        role: 'ANALYST',
        workspaceId,
      },
    });

    void this.sendEmailVerification(user.id, user.email);
    this.logger.log(`New user registered: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        workspaceId: user.workspaceId,
      },
    };
  }

  // ── Refresh rotation ───────────────────────────────────────────────

  async refresh(userId: string, email: string, role: Role, refreshTokenId: string): Promise<TokenPair> {
    await this.prisma.refreshToken.update({
      where: { id: refreshTokenId },
      data: { revokedAt: new Date() },
    });
    return this.issueTokenPair(userId, email, role);
  }

  // ── Logout ─────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Email verification ─────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken
      .findUnique({ where: { token } })
      .catch(() => null);

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.delete({ where: { token } }),
    ]);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.usersService.findByIdOrThrow(userId);
    if (user.emailVerifiedAt) throw new BadRequestException('Email already verified');
    await this.sendEmailVerification(user.id, user.email);
  }

  // ── Password reset ─────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return; // Silent — never reveal if email exists

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 3_600_000);

    await this.prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, token, expiresAt },
      update: { token, expiresAt },
    });

    void this.emailService.sendPasswordReset(user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken
      .findUnique({ where: { token } })
      .catch(() => null);

    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcryptjs.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.delete({ where: { token } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.logger.log(`Password reset for user ${record.userId}`);
  }

  // ── Token issuance ─────────────────────────────────────────────────

  async issueTokenPair(userId: string, email: string, role: Role): Promise<TokenPair> {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);
    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    void this.pruneExpiredTokens(userId);
    return { accessToken, refreshToken };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async handleFailedLogin(userId: string, currentAttempts: number): Promise<void> {
    const attempts = currentAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : null,
      },
    });

    if (shouldLock) {
      this.logger.warn(`Account ${userId} locked after ${attempts} failed attempts`);
    }
  }

  private async sendEmailVerification(userId: string, email: string): Promise<void> {
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + EMAIL_TTL_HOURS * 3_600_000);

    await this.prisma.emailVerificationToken.upsert({
      where: { userId },
      create: { userId, token, expiresAt },
      update: { token, expiresAt },
    });

    void this.emailService.sendEmailVerification(email, token);
  }

  private async pruneExpiredTokens(userId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
        },
      });
    } catch { /* non-critical */ }
  }
}
