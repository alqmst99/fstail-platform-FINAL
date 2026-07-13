// src/audit/audit.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
import { calculateScore, mergeSections } from './audit.scoring';
type AuditStatus = 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
import type {
  CreateAuditDto,
  UpdateAuditDto,
  UpdateAuditSectionsDto,
  QueryAuditsDto,
} from './dto/audit.dto';

// Default section template used when no templateId is specified
const DEFAULT_SECTIONS = [
  { key: 'performance',    label: 'Performance',      weight: 20 },
  { key: 'seo',            label: 'SEO & Visibility',  weight: 20 },
  { key: 'ux',             label: 'UX & Design',       weight: 20 },
  { key: 'security',       label: 'Security',          weight: 20 },
  { key: 'accessibility',  label: 'Accessibility',     weight: 10 },
  { key: 'content',        label: 'Content & Copy',    weight: 10 },
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────

  async findAll(workspaceId: string, query: QueryAuditsDto) {
    const where = {
      workspaceId,
      deletedAt: null,
      ...(query.status   && { status:    query.status    }),
      ...(query.clientId && { clientId:  query.clientId  }),
      ...(query.projectId && { projectId: query.projectId }),
      ...(query.search && {
        title: { contains: query.search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.audit.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          finalScore: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          client:  { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
          createdBy: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.audit.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  // ── Find one ──────────────────────────────────────────────────────

  async findOne(id: string, workspaceId: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        client:   { select: { id: true, name: true, status: true } },
        project:  { select: { id: true, title: true, status: true } },
        template: { select: { id: true, name: true, sections: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    if (!audit) throw new NotFoundException(`Audit ${id} not found`);

    // Attach live score calculation
    const sections = audit.sections as any[];
    const scoreResult = calculateScore(sections);

    return { ...audit, scoreResult };
  }

  // ── Create ────────────────────────────────────────────────────────

  async create(dto: CreateAuditDto, workspaceId: string, userId: string) {
    // Resolve template sections
    let templateSections = DEFAULT_SECTIONS;
    let templateId: string | undefined = dto.templateId;

    if (dto.templateId) {
      const template = await this.prisma.auditTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`);
      templateSections = (template.sections as any[]).map((s: any) => ({
        key:    s.key,
        label:  s.label,
        weight: s.weight ?? 0,
      }));
    } else {
      // Try to find the default template
      const defaultTemplate = await this.prisma.auditTemplate.findFirst({
        where: { isDefault: true },
      });
      if (defaultTemplate) templateId = defaultTemplate.id;
    }

    // Validate clientId / projectId belong to this workspace
    if (dto.clientId) {
      await this.assertClientExists(dto.clientId, workspaceId);
    }
    if (dto.projectId) {
      await this.assertProjectExists(dto.projectId, workspaceId);
    }

    // Initialise empty sections from template
    const sections = templateSections.map((s: {key:string;label:string;weight:number}) => ({
      key:          s.key,
      label:        s.label,
      weight:       s.weight,
      score:        null,
      observations: '',
      evidenceUrls: [],
    }));

    const audit = await this.prisma.audit.create({
      data: {
        title:       dto.title,
        workspaceId,
        clientId:    dto.clientId,
        projectId:   dto.projectId,
        templateId,
        generalInfo: (dto.generalInfo as any) ?? {},
        sections:    sections as any,
        status:      'DRAFT' as AuditStatus,
        createdById: userId,
      },
    });

    this.logger.log(`Audit created: ${audit.id} by user ${userId}`);
    return audit;
  }

  // ── Update metadata ───────────────────────────────────────────────

  async update(id: string, dto: UpdateAuditDto, workspaceId: string) {
    await this.assertAuditExists(id, workspaceId);

    return this.prisma.audit.update({
      where: { id },
      data: {
        ...(dto.title       && { title:       dto.title       }),
        ...(dto.status      && { status:      dto.status      }),
        ...(dto.clientId    && { clientId:    dto.clientId    }),
        ...(dto.projectId   && { projectId:   dto.projectId   }),
        ...(dto.generalInfo && { generalInfo: dto.generalInfo as any }),
      },
    });
  }

  // ── Update sections (with optimistic locking) ─────────────────────

  async updateSections(
    id: string,
    dto: UpdateAuditSectionsDto,
    workspaceId: string,
  ) {
    const audit = await this.assertAuditExists(id, workspaceId);

    if (audit.status === 'DONE' as AuditStatus || audit.status === 'ARCHIVED' as AuditStatus) {
      throw new ForbiddenException('Cannot edit a completed or archived audit');
    }

    // Optimistic lock check
    if (audit.version !== dto.version) {
      throw new ConflictException(
        `Audit was modified by someone else. ` +
        `Your version: ${dto.version}, current: ${audit.version}. ` +
        `Please reload and try again.`,
      );
    }

    // Merge incoming section updates with existing stored sections
    const existingSections = (audit.sections as any[]) ?? [];
    const merged = mergeSections(existingSections, dto.sections);

    // Recalculate score
    const { finalScoreInt, isComplete } = calculateScore(merged);

    // Auto-advance to IN_PROGRESS on first save
    const newStatus =
      audit.status === 'DRAFT' as AuditStatus ? 'IN_PROGRESS' as AuditStatus : audit.status;

    const updated = await this.prisma.audit.update({
      where: { id },
      data: {
        sections:   merged as any,
        finalScore: finalScoreInt,
        status:     newStatus,
        version:    { increment: 1 }, // bump version
      },
    });

    const scoreResult = calculateScore(merged);
    return { ...updated, scoreResult, isComplete };
  }

  // ── Submit (mark as DONE) ─────────────────────────────────────────

  async submit(id: string, workspaceId: string) {
    const audit = await this.assertAuditExists(id, workspaceId);

    if (audit.status === 'DONE' as AuditStatus) {
      throw new BadRequestException('Audit is already submitted');
    }

    const sections = (audit.sections as any[]) ?? [];
    const { scoredSections, totalSections, finalScoreInt } = calculateScore(sections);

    if (scoredSections === 0) {
      throw new BadRequestException('Cannot submit an audit with no scored sections');
    }

    if (scoredSections < totalSections) {
      this.logger.warn(
        `Audit ${id} submitted with ${scoredSections}/${totalSections} sections scored`,
      );
    }

    return this.prisma.audit.update({
      where: { id },
      data: {
        status:     'DONE' as AuditStatus,
        finalScore: finalScoreInt,
        version:    { increment: 1 },
      },
    });
  }

  // ── Soft delete ───────────────────────────────────────────────────

  async remove(id: string, workspaceId: string) {
    await this.assertAuditExists(id, workspaceId);
    return this.prisma.audit.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── Templates ─────────────────────────────────────────────────────

  async findTemplates() {
    return this.prisma.auditTemplate.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        sections: true,
      },
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────

  async getStats(workspaceId: string) {
    const [total, byStatus, avgScore] = await this.prisma.$transaction([
      this.prisma.audit.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.audit.groupBy({
        by: ['status'],
        where: { workspaceId, deletedAt: null },
        _count: { status: true },
      }),
      this.prisma.audit.aggregate({
        where: { workspaceId, deletedAt: null, status: 'DONE' as AuditStatus, finalScore: { not: null } },
        _avg: { finalScore: true },
      }),
    ]);

    const statusMap = Object.fromEntries(
      byStatus.map((s: {status: string; _count: {status: number}}) => [s.status, s._count.status]),
    );

    return {
      total,
      draft:      statusMap['DRAFT']       ?? 0,
      inProgress: statusMap['IN_PROGRESS'] ?? 0,
      done:       statusMap['DONE']        ?? 0,
      archived:   statusMap['ARCHIVED']    ?? 0,
      avgScore:   avgScore._avg.finalScore
        ? Math.round(avgScore._avg.finalScore * 10) / 10
        : null,
    };
  }

  // ── Private ───────────────────────────────────────────────────────

  private async assertAuditExists(id: string, workspaceId: string) {
    const audit = await this.prisma.audit.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!audit) throw new NotFoundException(`Audit ${id} not found`);
    return audit;
  }

  private async assertClientExists(clientId: string, workspaceId: string) {
    const c = await this.prisma.client.findFirst({
      where: { id: clientId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new BadRequestException(`Client ${clientId} not found in this workspace`);
  }

  private async assertProjectExists(projectId: string, workspaceId: string) {
    const p = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!p) throw new BadRequestException(`Project ${projectId} not found in this workspace`);
  }
}
