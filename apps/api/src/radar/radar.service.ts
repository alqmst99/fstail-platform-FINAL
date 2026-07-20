// src/radar/radar.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FreelancerClient } from './freelancer.client';
import { ProposalGenerator } from './proposal.generator';
import { paginate } from '../common/dto/pagination.dto';
type ProposalFramework = 'AIDA' | 'PAS' | 'BAB';
import type {
  ScanDto,
  GenerateProposalDto,
  QueryScansDto,
  QueryProposalsDto,
} from './dto/radar.dto';

@Injectable()
export class RadarService {
  private readonly logger = new Logger(RadarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly freelancerClient: FreelancerClient,
    private readonly proposalGenerator: ProposalGenerator,
  ) {}

  // ── Scan ──────────────────────────────────────────────────────────

  async scan(dto: ScanDto, workspaceId: string, userId: string) {
    const { projects, rawCount, validCount } =
      await this.freelancerClient.fetchProjects(dto);

    const scan = await this.prisma.radarScan.create({
      data: {
        workspaceId,
        userId,
        sourceUrl: dto.sourceUrl ?? null,
        keyword:   dto.keyword   ?? null,
        rawCount,
        validCount,
        projects:  projects as any,
      },
    });

    this.logger.log(
      `Scan ${scan.id}: ${validCount}/${rawCount} projects passed filters`,
    );

    return {
      scanId:     scan.id,
      rawCount,
      validCount,
      projects,
      scannedAt:  scan.createdAt,
    };
  }

  // ── List scans ────────────────────────────────────────────────────

  async findScans(workspaceId: string, query: QueryScansDto) {
    const where = {
      workspaceId,
      ...(query.keyword && {
        keyword: { contains: query.keyword, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.radarScan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id:         true,
          keyword:    true,
          sourceUrl:  true,
          rawCount:   true,
          validCount: true,
          createdAt:  true,
          _count: { select: { proposals: true } },
        },
      }),
      this.prisma.radarScan.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  // ── Get single scan ───────────────────────────────────────────────

  async findScan(id: string, workspaceId: string) {
    const scan = await this.prisma.radarScan.findFirst({
      where: { id, workspaceId },
      include: {
        proposals: {
          orderBy: { createdAt: 'desc' },
          select: {
            id:             true,
            projectTitle:   true,
            framework:      true,
            suggestedPrice: true,
            difficulty:     true,
            createdAt:      true,
          },
        },
      },
    });

    if (!scan) throw new NotFoundException(`Scan ${id} not found`);
    return scan;
  }

  // ── Generate proposal ─────────────────────────────────────────────

  async generateProposal(
    dto: GenerateProposalDto,
    workspaceId: string,
    userId: string,
  ) {
    const project = dto.project as any;
    const framework = dto.framework ?? 'AIDA' as ProposalFramework;

    const generated = await this.proposalGenerator.generate(
      project,
      framework,
      dto.context,
    );

    const proposal = await this.prisma.proposal.create({
      data: {
        workspaceId,
        createdById:       userId,
        scanId:            dto.scanId ?? null,
        projectIdExternal: String(project['id']    ?? ''),
        projectTitle:      String(project['title'] ?? ''),
        projectUrl:        project['seoUrl'] ? `https://www.freelancer.com/projects/${project['seoUrl']}` : null,
        framework,
        proposalText:      generated.proposalText,
        suggestedPrice:    generated.suggestedPrice,
        deliveryDays:      generated.deliveryDays,
        difficulty:        generated.difficulty as any,
        clientSummary:     generated.clientSummary,
        checklist:         generated.checklist as any,
        modelUsed:         generated.modelUsed,
      },
    });

    return { proposal, generated };
  }

  // ── List proposals ────────────────────────────────────────────────

  async findProposals(workspaceId: string, query: QueryProposalsDto) {
    const where = {
      workspaceId,
      ...(query.framework && { framework: query.framework }),
      ...(query.scanId    && { scanId:    query.scanId    }),
      ...(query.search && {
        projectTitle: { contains: query.search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.proposal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id:             true,
          projectTitle:   true,
          projectUrl:     true,
          framework:      true,
          proposalText:   true,
          suggestedPrice: true,
          deliveryDays:   true,
          difficulty:     true,
          clientSummary:  true,
          checklist:      true,
          modelUsed:      true,
          createdAt:      true,
        },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return paginate(data, total, query);
  }

  // ── Get single proposal ───────────────────────────────────────────

  async findProposal(id: string, workspaceId: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id, workspaceId },
    });
    if (!proposal) throw new NotFoundException(`Proposal ${id} not found`);
    return proposal;
  }

  // ── Delete proposal ───────────────────────────────────────────────

  async deleteProposal(id: string, workspaceId: string) {
    await this.findProposal(id, workspaceId);
    return this.prisma.proposal.delete({ where: { id } });
  }

  // ── Stats ─────────────────────────────────────────────────────────

  async getStats(workspaceId: string) {
    const [scans, proposals, byFramework] = await this.prisma.$transaction([
      this.prisma.radarScan.count({ where: { workspaceId } }),
      this.prisma.proposal.count({ where: { workspaceId } }),
      this.prisma.proposal.groupBy({
        by: ['framework'],
        where: { workspaceId },
        orderBy: { framework: 'asc' },
        _count: { framework: true },
      }),
    ]);

    return {
      totalScans:     scans,
      totalProposals: proposals,
      byFramework: Object.fromEntries(
        byFramework.map((f: any) => [f.framework, f._count?.framework ?? 0]),
      ),
    };
  }
}
