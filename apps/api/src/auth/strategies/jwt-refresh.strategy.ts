// src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@fstail/types';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['refreshToken'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // We need req to read the raw token
    });
  }

  /**
   * Validates that the refresh token exists in the DB and hasn't been revoked.
   * This is the security check that prevents reuse after logout or rotation.
   */
  async validate(req: Request, payload: JwtPayload) {
    const rawToken = req.cookies?.['refreshToken'];

    if (!rawToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: rawToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            workspaceId: true,
            deletedAt: true,
            lockedUntil: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.user.deletedAt) {
      throw new UnauthorizedException('User deactivated');
    }

    return { ...storedToken.user, refreshTokenId: storedToken.id };
  }
}
