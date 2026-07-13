// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '@fstail/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Extract token from HttpOnly cookie (not Authorization header)
      // This is the secure pattern — token never accessible to JS
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['accessToken'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Called after signature + expiry are verified by Passport.
   * We load the full user from DB to catch deactivated accounts.
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        workspaceId: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    // Returned value is attached to req.user by Passport
    return user;
  }
}
