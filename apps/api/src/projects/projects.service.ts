// src/projects/projects.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
import type { CreateProjectDto, UpdateProjectDto, QueryProjectsDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, query: QueryProjectsDto) {
    const where = {
      workspaceId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' as const } },
          { description: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          client: { select: { id: true, name: true, status: true } },
          _count: { select: { audits: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  async findOne(id: string, workspaceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, email: true, status: true } },
        audits: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
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

    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async create(dto: CreateProjectDto, workspaceId: string) {
    // Validate clientId belongs to this workspace
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!client) {
        throw new BadRequestException(`Client ${dto.clientId} not found in this workspace`);
      }
    }

    return this.prisma.project.create({
      data: {
        ...dto,
        workspaceId,
        metadata: dto.metadata ?? {},
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateProjectDto, workspaceId: string) {
    await this.assertExists(id, workspaceId);

    // Validate new clientId if provided
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!client) {
        throw new BadRequestException(`Client ${dto.clientId} not found in this workspace`);
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: dto,
      include: { client: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string, workspaceId: string) {
    await this.assertExists(id, workspaceId);
    return this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStats(workspaceId: string) {
    const [total, byStatus] = await this.prisma.$transaction([
      this.prisma.project.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.project.groupBy({
        by: ['status'],
        where: { workspaceId, deletedAt: null },
        _count: { status: true },
      }),
    ]);

    const statusMap = Object.fromEntries(
      byStatus.map((s: { status: string; _count: { status: number } }) => [s.status, s._count.status]),
    );

    return {
      total,
      active: statusMap['ACTIVE'] ?? 0,
      completed: statusMap['COMPLETED'] ?? 0,
      onHold: statusMap['ON_HOLD'] ?? 0,
      cancelled: statusMap['CANCELLED'] ?? 0,
    };
  }

  private async assertExists(id: string, workspaceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }
}
