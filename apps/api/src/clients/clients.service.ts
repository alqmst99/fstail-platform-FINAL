// src/clients/clients.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
import type { CreateClientDto, UpdateClientDto, QueryClientsDto } from './dto/client.dto';
import type { AuthUser } from '@fstail/types';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────

  async findAll(workspaceId: string, query: QueryClientsDto) {
    const where = {
      workspaceId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
          { phone: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          website: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { projects: true, audits: true } },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  // ── Find one ──────────────────────────────────────────────────────

  async findOne(id: string, workspaceId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        projects: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
        audits: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            finalScore: true,
            createdAt: true,
          },
        },
      },
    });

    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  // ── Create ────────────────────────────────────────────────────────

  async create(dto: CreateClientDto, workspaceId: string, userId: string) {
    return this.prisma.client.create({
      data: {
        ...dto,
        workspaceId,
        createdById: userId,
          metadata: (dto.metadata ?? {}) as any,
      },
    });
  }

  // ── Update ────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateClientDto, workspaceId: string) {
    await this.assertExists(id, workspaceId);

    return this.prisma.client.update({
      where: { id },
      data: dto as any,
    });
  }

  // ── Soft delete ───────────────────────────────────────────────────

  async remove(id: string, workspaceId: string, user: AuthUser) {
    await this.assertExists(id, workspaceId);

    // Only ADMIN+ can delete clients
    if (user.role === 'ANALYST' || user.role === 'CLIENT') {
      throw new ForbiddenException('Insufficient permissions to delete clients');
    }

    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────

  async getStats(workspaceId: string) {
    const [total, byStatus] = await this.prisma.$transaction([
      this.prisma.client.count({
        where: { workspaceId, deletedAt: null },
      }),
      this.prisma.client.groupBy({
        by: ['status'],
        where: { workspaceId, deletedAt: null },
          orderBy: { status: 'asc' },
          _count: { status: true },
      }),
    ]);

    const statusMap = Object.fromEntries(
        byStatus.map((s: any) => [s.status, s._count?.status ?? 0]),
    );

    return {
      total,
      leads: statusMap['LEAD'] ?? 0,
      active: statusMap['ACTIVE'] ?? 0,
      inactive: statusMap['INACTIVE'] ?? 0,
      archived: statusMap['ARCHIVED'] ?? 0,
    };
  }

  // ── Private ───────────────────────────────────────────────────────

  private async assertExists(id: string, workspaceId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }
}
