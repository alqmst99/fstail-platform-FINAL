// src/reports/reports.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
import { randomUUID } from 'crypto';
import { calculateScore } from '../audit/audit.scoring';
import type {
  CreateReportDto,
  UpdateReportDto,
  PublishReportDto,
  QueryReportsDto,
  ReportBlock,
} from './dto/report.dto';

const DEFAULT_PORTAL_TTL_DAYS = 30;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────

  async findAll(workspaceId: string, query: QueryReportsDto) {
    const where = {
      workspaceId,
      deletedAt: null,
      ...(query.search && {
        title: { contains: query.search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id:                   true,
          title:                true,
          portalToken:          true,
          portalTokenExpiresAt: true,
          createdAt:            true,
          updatedAt:            true,
          createdBy: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    // Annotate with portal status
    const annotated = data.map((r: Record<string,unknown>) => ({
      ...r,
      portalActive: r.portalToken !== null && (r.portalTokenExpiresAt == null || (r.portalTokenExpiresAt as Date) > new Date()),
    }));

    return paginate(annotated, total, query);
  }

  // ── Find one ──────────────────────────────────────────────────────

  async findOne(id: string, workspaceId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, displayName: true } },
      },
    });

    if (!report) throw new NotFoundException(`Report ${id} not found`);

    return {
      ...report,
      portalActive: this.isPortalActive(report),
    };
  }

  // ── Create ────────────────────────────────────────────────────────

  async create(dto: CreateReportDto, workspaceId: string, userId: string) {
    // If auditIds provided, auto-build initial blocks
    let blocks: ReportBlock[] = dto.blocks ?? [];

    if (dto.auditIds?.length && blocks.length === 0) {
      const audits = await this.prisma.audit.findMany({
        where: {
          id: { in: dto.auditIds },
          workspaceId,
          deletedAt: null,
        },
        select: {
          id:         true,
          title:      true,
          status:     true,
          finalScore: true,
          sections:   true,
          client:     { select: { id: true, name: true } },
        },
      });

      blocks = this.buildBlocksFromAudits(audits);
    }

    const content = { blocks, version: 1 };

    return this.prisma.report.create({
      data: {
        title:       dto.title,
        workspaceId,
        createdById: userId,
        content:     content as any,
      },
    });
  }

  // ── Update ────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateReportDto, workspaceId: string) {
    const report = await this.assertExists(id, workspaceId);

    const data: Record<string, unknown> = {};
    if (dto.title) data['title'] = dto.title;

    if (dto.blocks) {
      const existing = report.content as any;
      data['content'] = {
        ...existing,
        blocks: dto.blocks,
        version: (existing?.version ?? 1) + 1,
      };
    }

    if (dto.content) {
      data['content'] = dto.content;
    }

    return this.prisma.report.update({
      where: { id },
      data,
    });
  }

  // ── Publish (generate portal token) ──────────────────────────────

  async publish(id: string, dto: PublishReportDto, workspaceId: string) {
    await this.assertExists(id, workspaceId);

    const ttl = dto.ttlDays ?? DEFAULT_PORTAL_TTL_DAYS;
    const portalToken = randomUUID();
    const portalTokenExpiresAt = new Date(Date.now() + ttl * 86_400_000);

    const updated = await this.prisma.report.update({
      where: { id },
      data: { portalToken, portalTokenExpiresAt },
      select: {
        id:                   true,
        title:                true,
        portalToken:          true,
        portalTokenExpiresAt: true,
      },
    });

    const portalUrl = `${process.env['APP_URL'] ?? 'http://localhost:3000'}/portal/${portalToken}`;
    this.logger.log(`Report ${id} published — portal URL: ${portalUrl}`);

    return { ...updated, portalUrl, expiresAt: portalTokenExpiresAt };
  }

  // ── Unpublish (revoke portal token) ──────────────────────────────

  async unpublish(id: string, workspaceId: string) {
    await this.assertExists(id, workspaceId);

    return this.prisma.report.update({
      where: { id },
      data: { portalToken: null, portalTokenExpiresAt: null },
    });
  }

  // ── Portal access (public — no auth) ─────────────────────────────

  async findByPortalToken(token: string) {
    const report = await this.prisma.report.findFirst({
      where: {
        portalToken: token,
        deletedAt:   null,
      },
      select: {
        id:                   true,
        title:                true,
        content:              true,
        portalTokenExpiresAt: true,
        createdAt:            true,
        updatedAt:            true,
        workspace: {
          select: { name: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('This report link is invalid or has been removed');
    }

    if (report.portalTokenExpiresAt && report.portalTokenExpiresAt < new Date()) {
      throw new ForbiddenException('This report link has expired');
    }

    return report;
  }

  // ── Soft delete ───────────────────────────────────────────────────

  async remove(id: string, workspaceId: string) {
    await this.assertExists(id, workspaceId);
    return this.prisma.report.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async assertExists(id: string, workspaceId: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  private isPortalActive(report: {
    portalToken: string | null;
    portalTokenExpiresAt: Date | null;
  }): boolean {
    if (!report.portalToken) return false;
    if (!report.portalTokenExpiresAt) return true;
    return report.portalTokenExpiresAt > new Date();
  }

  private buildBlocksFromAudits(audits: any[]): ReportBlock[] {
    const blocks: ReportBlock[] = [];

    // Heading block
    blocks.push({
      type: 'heading',
      id:   randomUUID(),
      data: { text: 'Audit Report', level: 1 },
    });

    // Intro text
    blocks.push({
      type: 'text',
      id:   randomUUID(),
      data: {
        text: `This report summarises ${audits.length} audit${audits.length !== 1 ? 's' : ''} conducted by FSTail Solutions.`,
      },
    });

    // One audit_summary block per audit
    for (const audit of audits) {
      const sections = (audit.sections ?? []) as any[];
      const scoreResult = calculateScore(sections);

      blocks.push({
        type: 'audit_summary',
        id:   randomUUID(),
        data: {
          auditId:      audit.id,
          title:        audit.title,
          clientName:   audit.client?.name ?? null,
          status:       audit.status,
          finalScore:   audit.finalScore,
          grade:        scoreResult.grade,
          sections:     sections.map((s: any) => ({
            key:          s.key,
            label:        s.label,
            score:        s.score,
            observations: s.observations,
          })),
        },
      });
    }

    // Comparison block if multiple audits
    if (audits.length > 1) {
      blocks.push({
        type: 'audit_comparison',
        id:   randomUUID(),
        data: {
          auditIds: audits.map((a) => a.id),
          scores:   audits.map((a) => ({
            id:    a.id,
            title: a.title,
            score: a.finalScore,
          })),
        },
      });
    }

    // Recommendations block (empty — analyst fills in)
    blocks.push({
      type: 'recommendations',
      id:   randomUUID(),
      data: { items: [] },
    });

    return blocks;
  }
}
