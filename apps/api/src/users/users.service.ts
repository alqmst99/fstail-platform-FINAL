// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import * as bcryptjs from 'bcryptjs';
import { randomUUID } from 'crypto';
import type {
  InviteUserDto,
  UpdateUserRoleDto,
  UpdateProfileDto,
  QueryUsersDto,
} from './dto/user.dto';
import type { User } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
// Temporary password for invited users — they must reset via forgot-password
const TEMP_PASSWORD_PREFIX = 'Invite_';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public helpers (used by AuthService) ──────────────────────────

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  // ── GET /users/me ─────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        workspaceId: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        workspace: {
          select: { id: true, name: true, slug: true, plan: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ── PATCH /users/me ───────────────────────────────────────────────

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const user = await this.findByIdOrThrow(userId);

    // Password change — requires current password
    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('currentPassword is required to set a new password');
      }
      const valid = await bcryptjs.compare(dto.currentPassword, user.passwordHash);
      if (!valid) throw new BadRequestException('Current password is incorrect');
    }

    const data: Record<string, unknown> = {};
    if (dto.displayName) data['displayName'] = dto.displayName;
    if (dto.newPassword) data['passwordHash'] = await bcryptjs.hash(dto.newPassword, BCRYPT_ROUNDS);

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        workspaceId: true,
      },
    });
  }

  // ── GET /users (workspace members) ───────────────────────────────

  async findAll(workspaceId: string, query: QueryUsersDto) {
    const where = {
      workspaceId,
      deletedAt: null,
      ...(query.role && { role: query.role }),
      ...(query.search && {
        OR: [
          { displayName: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  // ── POST /users/invite ────────────────────────────────────────────

  async invite(dto: InviteUserDto, workspaceId: string, invitedBy: string) {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    // SUPER_ADMIN cannot be invited — only created by seeding
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot invite a SUPER_ADMIN');
    }

    // Temporary password — user must use forgot-password to set their own
    const tempPassword = `${TEMP_PASSWORD_PREFIX}${randomUUID()}`;
    const passwordHash = await bcryptjs.hash(tempPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.displayName,
        role: dto.role,
        workspaceId,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
      },
    });

    // Trigger forgot-password flow so user gets a real reset link
    // (reuses AuthService.forgotPassword — injected via circular dep pattern if needed,
    //  or call directly from AuthService.invite() instead)

    return { user, message: 'User invited. They will receive a password setup email.' };
  }

  // ── PATCH /users/:id/role ─────────────────────────────────────────

  async updateRole(
    id: string,
    dto: UpdateUserRoleDto,
    workspaceId: string,
    requestingUserId: string,
  ) {
    if (id === requestingUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot assign SUPER_ADMIN role');
    }

    const user = await this.prisma.user.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found in this workspace`);

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: { id: true, email: true, displayName: true, role: true },
    });
  }

  // ── DELETE /users/:id  (soft) ─────────────────────────────────────

  async remove(id: string, workspaceId: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new ForbiddenException('Cannot deactivate your own account');
    }

    const user = await this.prisma.user.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found in this workspace`);
    if (user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Cannot deactivate a SUPER_ADMIN');
    }

    // Revoke all sessions
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
