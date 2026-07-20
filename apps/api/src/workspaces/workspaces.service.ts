// src/workspaces/workspaces.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import type {
  UpdateWorkspaceDto,
  TransferOwnershipDto,
  UpdatePlanDto,
} from './dto/workspace.dto';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Get workspace ──────────────────────────────────────────────────

  async findOne(workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      include: {
        owner: {
          select: { id: true, displayName: true, email: true },
        },
        _count: {
          select: {
            users:   true,
            clients: true,
            audits:  true,
          },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  // ── Update workspace metadata ──────────────────────────────────────

  async update(
    workspaceId: string,
    dto: UpdateWorkspaceDto,
    requestingUserId: string,
  ) {
    await this.assertIsAdmin(workspaceId, requestingUserId);

    // Slug uniqueness check
    if (dto.slug) {
      const existing = await this.prisma.workspace.findFirst({
        where: { slug: dto.slug, id: { not: workspaceId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(`Slug '${dto.slug}' is already taken`);
      }
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.name     && { name:     dto.name     }),
        ...(dto.slug     && { slug:     dto.slug     }),
        ...(dto.settings && { settings: dto.settings as any }),
      },
    });
  }

  // ── Workspace usage stats ──────────────────────────────────────────

  async getStats(workspaceId: string) {
    const [counts, recentAudits, recentScans] = await this.prisma.$transaction([
      this.prisma.workspace.findFirst({
        where: { id: workspaceId },
        select: {
          plan: true,
          _count: {
            select: {
              users:      true,
              clients:    true,
              projects:   true,
              audits:     true,
              radarScans: true,
              proposals:  true,
              reports:    true,
            },
          },
        },
      }),
      this.prisma.audit.count({
        where: {
          workspaceId,
          deletedAt: null,
          createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
        },
      }),
      this.prisma.radarScan.count({
        where: {
          workspaceId,
          createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
        },
      }),
    ]);

    return {
      plan:           counts?.plan,
      totals:         counts?._count,
      last30Days: {
        audits:     recentAudits,
        radarScans: recentScans,
      },
    };
  }

  // ── Transfer ownership ─────────────────────────────────────────────

  async transferOwnership(
    workspaceId: string,
    dto: TransferOwnershipDto,
    currentOwnerId: string,
  ) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found');

    if (workspace.ownerId !== currentOwnerId) {
      throw new ForbiddenException('Only the workspace owner can transfer ownership');
    }

    if (dto.newOwnerId === currentOwnerId) {
      throw new BadRequestException('You are already the owner');
    }

    // Verify new owner is a member of this workspace
    const newOwner = await this.prisma.user.findFirst({
      where: {
        id:          dto.newOwnerId,
        workspaceId: workspaceId,
        deletedAt:   null,
      },
      select: { id: true, displayName: true, role: true },
    });

    if (!newOwner) {
      throw new NotFoundException('New owner must be a member of this workspace');
    }

    // Transfer ownership and promote new owner to ADMIN
    await this.prisma.$transaction([
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data:  { ownerId: dto.newOwnerId },
      }),
      this.prisma.user.update({
        where: { id: dto.newOwnerId },
        data:  { role: 'ADMIN' },
      }),
    ]);

    this.logger.log(
      `Workspace ${workspaceId} ownership transferred from ${currentOwnerId} to ${dto.newOwnerId}`,
    );

    return { message: `Ownership transferred to ${newOwner.displayName}` };
  }

  // ── Update plan (SUPER_ADMIN only) ─────────────────────────────────

  async updatePlan(workspaceId: string, dto: UpdatePlanDto) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data:  { plan: dto.plan },
    });
  }

  // ── Soft-delete workspace (SUPER_ADMIN only) ───────────────────────

  async remove(workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    // Revoke all user sessions in this workspace
    await this.prisma.refreshToken.updateMany({
      where: {
        user: { workspaceId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data:  { deletedAt: new Date() },
    });

    this.logger.warn(`Workspace ${workspaceId} (${workspace.name}) deleted`);
    return { message: 'Workspace deleted' };
  }

  // ── Private ────────────────────────────────────────────────────────

  private async assertIsAdmin(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, workspaceId, deletedAt: null },
      select: { role: true },
    });

    if (!user) throw new ForbiddenException('Not a member of this workspace');

    const allowed = ['SUPER_ADMIN', 'ADMIN'];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('Only workspace admins can perform this action');
    }
  }
}
