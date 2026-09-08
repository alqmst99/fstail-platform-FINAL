import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FreelancerAuthClient } from '../radar/freelancer-auth.client';
import {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  CreateMessageDto,
  QueryApplicationsDto,
} from './dto/application.dto';

/** Mirror of Prisma enum — after `prisma generate` you can import BidStatus from @prisma/client */
export type BidStatus =
  | 'POSTULADO'
  | 'EN_CONVERSACION'
  | 'ADJUDICADO_A_MIME'
  | 'ADJUDICADO_A_OTRO'
  | 'CANCELADO'
  | 'NO_ADJUDICADO';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly freelancer: FreelancerAuthClient,
  ) {}

  private get db() {
    // Typed after prisma generate; until then use accessor
    return this.prisma as PrismaService & {
      application: any;
      message: any;
      freelancerBidSnapshot: any;
    };
  }

  async create(dto: CreateApplicationDto, workspaceId: string) {
    if (this.freelancer.isConfigured()) {
      try {
        await this.freelancer.placeBid({
          projectId: Number(dto.freelancerProjId),
          amount: dto.submittedPrice,
          period: dto.submittedDays,
          description: dto.proposalText,
        });
        this.logger.log(`Bid placed on Freelancer project ${dto.freelancerProjId}`);
      } catch (err: any) {
        this.logger.error(`Freelancer bid failed: ${err.message}`);
        throw new BadRequestException(
          `No se pudo postular en Freelancer: ${err.message}. Revisá OAuth y cupo de bids.`,
        );
      }
    } else {
      this.logger.warn('Freelancer OAuth off — saving Application only (no real bid)');
    }

    const app = await this.db.application.create({
      data: {
        workspaceId,
        freelancerProjId: dto.freelancerProjId,
        title: dto.title,
        rawDescription: dto.rawDescription,
        translatedDesc: dto.translatedDesc,
        clientCountry: dto.clientCountry,
        clientHireRate: dto.clientHireRate,
        clientSpent: dto.clientSpent,
        avgBidPrice: dto.avgBidPrice,
        recommendedPrice: dto.recommendedPrice,
        submittedPrice: dto.submittedPrice,
        submittedDays: dto.submittedDays,
        proposalText: dto.proposalText,
        attachmentsText: dto.attachmentsText,
        assignedToUserTag: dto.assignedToUserTag ?? 'Dev1',
        status: 'POSTULADO' as BidStatus,
        source: 'RADAR',
      },
    });

    this.logger.log(`Application saved: ${app.id}`);
    return app;
  }

  async findAll(workspaceId: string, query: QueryApplicationsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { workspaceId };

    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim());
      where.status = { in: statuses };
    }

    if (query.assignedTo) {
      where.assignedToUserTag = query.assignedTo;
    }

    const [data, total] = await this.prisma.$transaction([
      this.db.application.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          messages: { orderBy: { timestamp: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      this.db.application.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, workspaceId: string) {
    const app = await this.db.application.findFirst({
      where: { id, workspaceId },
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async updateStatus(id: string, workspaceId: string, dto: UpdateApplicationStatusDto) {
    await this.findOne(id, workspaceId);
    return this.db.application.update({
      where: { id },
      data: {
        status: dto.status as BidStatus,
        winnerBidPrice: dto.winnerBidPrice,
        winnerRating: dto.winnerRating,
        winnerReviewsCount: dto.winnerReviewsCount,
      },
    });
  }

  async addMessage(applicationId: string, workspaceId: string, dto: CreateMessageDto) {
    const app = await this.findOne(applicationId, workspaceId);

    if (dto.sender === 'me' && this.freelancer.isConfigured()) {
      try {
        await this.freelancer.sendMessage(Number(app.freelancerProjId), dto.text);
      } catch (err: any) {
        this.logger.warn(`Could not push message to Freelancer: ${err.message}`);
      }
    }

    const message = await this.db.message.create({
      data: {
        applicationId,
        sender: dto.sender,
        text: dto.text,
        externalId: dto.externalId,
      },
    });

    if (dto.sender === 'client') {
      await this.db.application.update({
        where: { id: applicationId },
        data: { status: 'EN_CONVERSACION' as BidStatus },
      });
    }

    return message;
  }


  /**
   * Analytics de postulaciones: totales, conversión, pérdidas vs ganador.
   * "Vistos" ≈ EN_CONVERSACION + adjudicated (el cliente interactuó o cerró).
   */
  async stats(workspaceId: string, assignedTo?: string) {
    const where: Record<string, unknown> = { workspaceId };
    if (assignedTo) where.assignedToUserTag = assignedTo;

    const apps = await this.db.application.findMany({
      where,
      select: {
        id: true,
        status: true,
        submittedPrice: true,
        avgBidPrice: true,
        recommendedPrice: true,
        winnerBidPrice: true,
        winnerRating: true,
        winnerReviewsCount: true,
        title: true,
        clientCountry: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const total = apps.length;
    const byStatus: Record<string, number> = {};
    for (const a of apps) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    }

    const won = byStatus['ADJUDICADO_A_MIME'] || 0;
    const lost = byStatus['ADJUDICADO_A_OTRO'] || 0;
    const open =
      (byStatus['POSTULADO'] || 0) + (byStatus['EN_CONVERSACION'] || 0);
    const closed =
      won + lost + (byStatus['CANCELADO'] || 0) + (byStatus['NO_ADJUDICADO'] || 0);

    // Vistos: cliente respondió o el proyecto cerró (asumimos que miró bids)
    const viewed =
      (byStatus['EN_CONVERSACION'] || 0) +
      won +
      lost +
      (byStatus['NO_ADJUDICADO'] || 0);

    const conversionRate = total > 0 ? Math.round((won / total) * 1000) / 10 : 0;
    const viewRate = total > 0 ? Math.round((viewed / total) * 1000) / 10 : 0;
    const replyRate =
      total > 0
        ? Math.round(((byStatus['EN_CONVERSACION'] || 0) + won) / total * 1000) / 10
        : 0;

    const lostApps = apps.filter(
      (a: any) => a.status === 'ADJUDICADO_A_OTRO' && a.winnerBidPrice != null,
    );

    const priceGaps = lostApps.map((a: any) => ({
      id: a.id,
      title: a.title,
      submittedPrice: a.submittedPrice,
      winnerBidPrice: a.winnerBidPrice,
      delta: a.submittedPrice - a.winnerBidPrice,
      deltaPct:
        a.winnerBidPrice > 0
          ? Math.round(((a.submittedPrice - a.winnerBidPrice) / a.winnerBidPrice) * 1000) / 10
          : null,
      winnerRating: a.winnerRating,
      winnerReviewsCount: a.winnerReviewsCount,
      clientCountry: a.clientCountry,
    }));

    const avgSubmitted =
      apps.length > 0
        ? Math.round(
            (apps.reduce((s: number, a: any) => s + (a.submittedPrice || 0), 0) /
              apps.length) *
              100,
          ) / 100
        : 0;

    const avgWinnerWhenLost =
      lostApps.length > 0
        ? Math.round(
            (lostApps.reduce((s: number, a: any) => s + a.winnerBidPrice, 0) /
              lostApps.length) *
              100,
          ) / 100
        : null;

    const avgOurPriceWhenLost =
      lostApps.length > 0
        ? Math.round(
            (lostApps.reduce((s: number, a: any) => s + a.submittedPrice, 0) /
              lostApps.length) *
              100,
          ) / 100
        : null;

    const avgOverpricePct =
      priceGaps.filter((g: any) => g.deltaPct != null).length > 0
        ? Math.round(
            (priceGaps
              .filter((g: any) => g.deltaPct != null)
              .reduce((s: number, g: any) => s + g.deltaPct, 0) /
              priceGaps.filter((g: any) => g.deltaPct != null).length) *
              10,
          ) / 10
        : null;

    // Insights automáticos
    const insights: string[] = [];
    if (avgOverpricePct != null && avgOverpricePct > 15) {
      insights.push(
        `En pérdidas, tu precio promedió ${avgOverpricePct}% por encima del ganador. Probá bajar 10–15% en proyectos similares.`,
      );
    } else if (avgOverpricePct != null && avgOverpricePct < -5) {
      insights.push(
        `Perdés aunque cotizás por debajo del ganador (Δ ${avgOverpricePct}%). Revisá proposal/perfil, no solo precio.`,
      );
    }
    if (viewRate < 30 && total >= 5) {
      insights.push(
        `Solo ~${viewRate}% de bids parecen "vistos" (chat o cierre). Mejorá el gancho de las primeras 2 líneas.`,
      );
    }
    if (conversionRate >= 10 && total >= 5) {
      insights.push(`Conversión sólida (${conversionRate}%). Escalà volumen manteniendo filtros de calidad.`);
    }
    if (open > won + lost && total >= 8) {
      insights.push(
        `Tenés ${open} abiertas vs ${won + lost} cerradas. Seguimiento de mensajes puede destrabar adjudicaciones.`,
      );
    }

    return {
      total,
      byStatus,
      won,
      lost,
      open,
      closed,
      viewed,
      conversionRate,
      viewRate,
      replyRate,
      avgSubmitted,
      avgWinnerWhenLost,
      avgOurPriceWhenLost,
      avgOverpricePct,
      priceGaps: priceGaps.slice(0, 30),
      recentLost: priceGaps.slice(0, 10),
      insights,
    };
  }



  /**
   * Histórico desde Freelancer API + persistencia en Prisma (FreelancerBidSnapshot).
   * refresh=true fuerza pull API; si no, sirve cache local y opcionalmente revalida.
   */
  /**
   * Importa bids de Freelancer → FreelancerBidSnapshot + Application (Prisma).
   * Tope 120 para velocidad. Mapea WON/LOST a estados CRM.
   */
  async syncFreelancerBidsToApplications(workspaceId: string, maxTotal = 120) {
    if (!this.freelancer.isConfigured()) {
      const status = (this.freelancer as any).configStatus?.() ?? {};
      throw new BadRequestException(
        `OAuth Freelancer incompleto: hace falta FREELANCER_ACCESS_TOKEN cargado por Nest. status=${JSON.stringify(status)}. Revisá que el .env esté en la raíz del monorepo (ConfigModule envFilePath: ../../.env) y reiniciá la API.`,
      );
    }
    if (!this.freelancer.hasBidderId?.() && !process.env.FREELANCER_USER_ID) {
      throw new BadRequestException('FREELANCER_USER_ID requerido');
    }

    const myId = Number(process.env.FREELANCER_USER_ID);
    const rawBids = await this.freelancer.fetchAllMyBids(maxTotal);
    const normalized = rawBids.map((b: any) => this.normalizeFreelancerBid(b, myId));
    await this.persistBidSnapshots(workspaceId, normalized);

    let upserted = 0;
    let won = 0;
    let lost = 0;
    let pending = 0;

    for (const b of normalized) {
      const projectId = String(b.projectId || '');
      if (!projectId) continue;

      const status = this.outcomeToBidStatus(b.outcome);
      if (status === 'ADJUDICADO_A_MIME') won++;
      else if (status === 'ADJUDICADO_A_OTRO') lost++;
      else pending++;

      // assignedToUserTag = FREELANCER marca origen sin requerir columnas nuevas
      // (si ya corriste la migration de source/external_bid_id, se setean también)
      const baseCreate: any = {
        workspaceId,
        freelancerProjId: projectId,
        title: (b.projectTitle && !String(b.projectTitle).startsWith('Project #'))
          ? b.projectTitle
          : (b.projectTitle || `Project ${projectId}`),
        rawDescription: b.description || '',
        proposalText: b.description || '(importado desde Freelancer)',
        avgBidPrice: b.avgBid ?? 0,
        recommendedPrice: b.amount || 0,
        submittedPrice: b.amount || 0,
        submittedDays: b.period || 0,
        status,
        winnerBidPrice: b.winnerAmount ?? null,
        assignedToUserTag: 'FREELANCER',
      };
      const baseUpdate: any = {
        status,
        submittedPrice: baseCreate.submittedPrice,
        submittedDays: baseCreate.submittedDays,
        winnerBidPrice: baseCreate.winnerBidPrice,
        assignedToUserTag: 'FREELANCER',
        title: baseCreate.title,
      };
      // Campos opcionales de schema nuevo — se ignoran si Prisma aún no los tiene
      try {
        baseCreate.source = 'FREELANCER';
        baseCreate.externalBidId = b.bidId != null ? String(b.bidId) : null;
        baseUpdate.source = 'FREELANCER';
        baseUpdate.externalBidId = baseCreate.externalBidId;
        await this.db.application.upsert({
          where: { freelancerProjId: projectId },
          create: baseCreate,
          update: baseUpdate,
        });
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (msg.includes('Unknown argument `source`') || msg.includes('Unknown argument `externalBidId`')) {
          delete baseCreate.source;
          delete baseCreate.externalBidId;
          delete baseUpdate.source;
          delete baseUpdate.externalBidId;
          await this.db.application.upsert({
            where: { freelancerProjId: projectId },
            create: baseCreate,
            update: baseUpdate,
          });
        } else {
          throw err;
        }
      }
      upserted++;
    }

    this.logger.log(
      `Sync FL→Application: ${upserted} rows (WON=${won} LOST=${lost} PENDING=${pending})`,
    );
    return {
      imported: upserted,
      totalRaw: rawBids.length,
      won,
      lost,
      pending,
      maxTotal,
    };
  }

  private outcomeToBidStatus(outcome: string): BidStatus {
    switch (outcome) {
      case 'WON':
        return 'ADJUDICADO_A_MIME';
      case 'LOST':
        return 'ADJUDICADO_A_OTRO';
      case 'RETRACTED':
        return 'CANCELADO';
      case 'PENDING':
      default:
        return 'POSTULADO';
    }
  }

  async freelancerHistory(workspaceId: string, opts: { refresh?: boolean } = {}) {
    const refresh = opts.refresh !== false; // default: sync from API when OAuth ok

    if (refresh && this.freelancer.isConfigured()) {
      // también materializa en Application para el listado unificado
      try {
        await this.syncFreelancerBidsToApplications(workspaceId, 120);
      } catch (e: any) {
        this.logger.warn(`syncFreelancerBidsToApplications: ${e.message}`);
        const rawBids = await this.freelancer.fetchAllMyBids(120);
        const myId = Number(process.env.FREELANCER_USER_ID);
        const normalized = rawBids.map((b: any) => this.normalizeFreelancerBid(b, myId));
        await this.persistBidSnapshots(workspaceId, normalized);
      }
    } else if (refresh && !this.freelancer.isConfigured()) {
      this.logger.warn('freelancerHistory refresh skipped — OAuth not configured');
    }

    const rows = await this.db.freelancerBidSnapshot.findMany({
      where: { workspaceId },
      orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    const bids = rows.map((r: any) => ({
      bidId: r.externalBidId,
      projectId: r.projectId,
      projectTitle: r.projectTitle,
      seoUrl: r.seoUrl,
      amount: r.amount,
      period: r.period,
      description: r.description,
      awardStatus: r.awardStatus,
      outcome: r.outcome,
      clientViewed: r.clientViewed,
      profileViewed: r.profileViewed,
      winnerAmount: r.winnerAmount,
      submittedAt: r.submittedAt?.toISOString?.() || r.submittedAt,
      awardedAt: r.awardedAt?.toISOString?.() || r.awardedAt,
      projectStatus: r.projectStatus,
      bidCount: r.bidCount,
      avgBid: r.avgBid,
      currency: r.currency,
      lastSyncedAt: r.lastSyncedAt?.toISOString?.() || r.lastSyncedAt,
    }));

    return this.buildHistoryStats(bids, rows[0]?.lastSyncedAt);
  }

  private async persistBidSnapshots(workspaceId: string, bids: any[]) {
    const now = new Date();
    for (const b of bids) {
      const externalBidId = String(b.bidId);
      if (!externalBidId || externalBidId === 'undefined') continue;

      await this.db.freelancerBidSnapshot.upsert({
        where: {
          workspaceId_externalBidId: {
            workspaceId,
            externalBidId,
          },
        },
        create: {
          workspaceId,
          externalBidId,
          projectId: String(b.projectId || ''),
          projectTitle: b.projectTitle || `Project ${b.projectId}`,
          seoUrl: b.seoUrl || null,
          amount: b.amount || 0,
          period: b.period || 0,
          currency: b.currency || 'USD',
          description: b.description || null,
          awardStatus: b.awardStatus || null,
          outcome: b.outcome || 'UNKNOWN',
          clientViewed: !!b.clientViewed,
          profileViewed: !!b.profileViewed,
          winnerAmount: b.winnerAmount,
          bidCount: b.bidCount,
          avgBid: b.avgBid,
          projectStatus: b.projectStatus || null,
          submittedAt: b.submittedAt ? new Date(b.submittedAt) : null,
          awardedAt: b.awardedAt ? new Date(b.awardedAt) : null,
          meta: {},
          lastSyncedAt: now,
        },
        update: {
          projectId: String(b.projectId || ''),
          projectTitle: b.projectTitle || `Project ${b.projectId}`,
          seoUrl: b.seoUrl || null,
          amount: b.amount || 0,
          period: b.period || 0,
          currency: b.currency || 'USD',
          description: b.description || null,
          awardStatus: b.awardStatus || null,
          outcome: b.outcome || 'UNKNOWN',
          clientViewed: !!b.clientViewed,
          profileViewed: !!b.profileViewed,
          winnerAmount: b.winnerAmount,
          bidCount: b.bidCount,
          avgBid: b.avgBid,
          projectStatus: b.projectStatus || null,
          submittedAt: b.submittedAt ? new Date(b.submittedAt) : null,
          awardedAt: b.awardedAt ? new Date(b.awardedAt) : null,
          lastSyncedAt: now,
        },
      });
    }
    this.logger.log(`Persisted ${bids.length} Freelancer bid snapshots for workspace ${workspaceId}`);
  }

  private buildHistoryStats(bids: any[], lastSyncedAt?: Date | string) {
    const total = bids.length;
    const awarded = bids.filter((b) => b.outcome === 'WON').length;
    const lost = bids.filter((b) => b.outcome === 'LOST').length;
    const pending = bids.filter((b) => b.outcome === 'PENDING').length;
    const retracted = bids.filter((b) => b.outcome === 'RETRACTED').length;
    const viewed = bids.filter((b) => b.clientViewed === true).length;
    const profileVisited = bids.filter((b) => b.profileViewed === true).length;

    const conversionRate = total > 0 ? Math.round((awarded / total) * 1000) / 10 : 0;
    const viewRate = total > 0 ? Math.round((viewed / total) * 1000) / 10 : 0;

    const lostWithWinner = bids.filter(
      (b) => b.outcome === 'LOST' && b.winnerAmount != null,
    );
    const avgOurWhenLost =
      lostWithWinner.length > 0
        ? Math.round(
            (lostWithWinner.reduce((sum, b) => sum + (b.amount || 0), 0) /
              lostWithWinner.length) *
              100,
          ) / 100
        : null;
    const avgWinnerWhenLost =
      lostWithWinner.length > 0
        ? Math.round(
            (lostWithWinner.reduce((sum, b) => sum + (b.winnerAmount || 0), 0) /
              lostWithWinner.length) *
              100,
          ) / 100
        : null;

    const priceGaps = lostWithWinner
      .map((b) => ({
        projectId: b.projectId,
        title: b.projectTitle,
        yourAmount: b.amount,
        winnerAmount: b.winnerAmount,
        delta: (b.amount || 0) - (b.winnerAmount || 0),
        deltaPct:
          b.winnerAmount && b.winnerAmount > 0
            ? Math.round((((b.amount || 0) - b.winnerAmount) / b.winnerAmount) * 1000) / 10
            : null,
        awardedAt: b.awardedAt,
        seoUrl: b.seoUrl,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const insights: string[] = [];
    if (avgOurWhenLost != null && avgWinnerWhenLost != null && avgWinnerWhenLost > 0) {
      const pct =
        Math.round(((avgOurWhenLost - avgWinnerWhenLost) / avgWinnerWhenLost) * 1000) / 10;
      if (pct > 10) {
        insights.push(
          `En pérdidas, cotizaste ~${pct}% por encima del ganador (avg vos $${avgOurWhenLost} vs ganador $${avgWinnerWhenLost}).`,
        );
      } else if (pct < -5) {
        insights.push(
          `Perdés aunque cotizás por debajo del ganador (Δ ${pct}%). El problema no es solo precio.`,
        );
      }
    }
    if (total >= 5 && viewRate < 25) {
      insights.push(
        `Solo ~${viewRate}% de bids tienen señal de "visto". Mejorá el gancho de las primeras líneas.`,
      );
    }
    if (conversionRate > 0) {
      insights.push(`Conversión histórica: ${conversionRate}% (${awarded}/${total}).`);
    }

    return {
      source: 'freelancer_api+prisma',
      lastSyncedAt:
        lastSyncedAt instanceof Date
          ? lastSyncedAt.toISOString()
          : lastSyncedAt || null,
      cachedCount: total,
      total,
      awarded,
      lost,
      pending,
      retracted,
      viewed,
      profileVisited,
      conversionRate,
      viewRate,
      avgOurWhenLost,
      avgWinnerWhenLost,
      priceGaps: priceGaps.slice(0, 40),
      insights,
      bids,
    };
  }

  private normalizeFreelancerBid(b: any, myId: number) {
    const project = b.project || b.project_details || {};
    const rawAward = [
      b.award_status,
      b.frontend_bid_status,
      b.front_bid_status,
      b.bid_status,
      b.status,
      b.awardStatus,
    ]
      .filter((x) => x != null && String(x).length)
      .map((x) => String(x).toLowerCase());
    const awardStatus = rawAward[0] || '';
    const awardJoined = rawAward.join(' ');

    let outcome: 'WON' | 'LOST' | 'PENDING' | 'RETRACTED' | 'UNKNOWN' = 'UNKNOWN';

    if (
      (awardJoined.includes('awarded') || awardStatus === 'award' || awardStatus === 'accepted') &&
      !awardJoined.includes('not_awarded') &&
      !awardJoined.includes('reject') &&
      !awardJoined.includes('revoke')
    ) {
      outcome = 'WON';
    }
    if (
      awardJoined.includes('reject') ||
      awardJoined.includes('lost') ||
      awardJoined.includes('not_awarded') ||
      awardJoined.includes('declined') ||
      awardStatus === 'unawarded'
    ) {
      outcome = 'LOST';
    }
    if (
      awardJoined.includes('retract') ||
      awardJoined.includes('withdraw') ||
      awardJoined.includes('cancel')
    ) {
      outcome = 'RETRACTED';
    }
    if (outcome === 'UNKNOWN') {
      if (
        !awardStatus ||
        awardStatus === 'active' ||
        awardStatus === 'pending' ||
        awardJoined.includes('pending')
      ) {
        outcome = 'PENDING';
      }
    }

    const selectedList = Array.isArray(project.selected_bids)
      ? project.selected_bids
      : project.selected_bids
        ? [project.selected_bids]
        : [];
    const selected = selectedList[0] || null;
    const selectedId = Number(selected?.id || b.selected_bid_id || project.bid_stats?.selected_bid_id || 0);
    const selectedBidder = Number(selected?.bidder_id || selected?.user_id || selected?.freelancer_id || 0);

    if (selectedId && Number(b.id) === selectedId) outcome = 'WON';
    if (selectedBidder && selectedBidder === myId) outcome = 'WON';
    if (selectedId && Number(b.id) !== selectedId && selectedId > 0 && outcome === 'PENDING') {
      outcome = 'LOST';
    }
    if (selectedBidder && selectedBidder !== myId && selectedBidder > 0 && outcome === 'PENDING') {
      outcome = 'LOST';
    }

    const pStatus = String(project.status || project.frontend_project_status || '').toLowerCase();
    const projectClosed =
      ['closed', 'completed', 'cancelled', 'canceled'].includes(pStatus) || pStatus.includes('complete');
    if (projectClosed && outcome === 'PENDING') outcome = 'LOST';
    if (outcome === 'UNKNOWN') outcome = 'PENDING';

    const clientViewed = Boolean(
      b.client_viewed_at || b.viewed || b.is_viewed || b.highlights?.viewed || b.bid_insights?.viewed || b.time_viewed,
    );
    const profileViewed = Boolean(
      b.profile_viewed_at || b.profile_viewed || b.highlights?.profile_viewed || b.bid_insights?.profile_viewed,
    );

    let winnerAmount: number | null = null;
    if (selected && Number(selected.bidder_id || selected.user_id || 0) !== myId) {
      winnerAmount = Number(selected.amount || selected.bid_amount || 0) || null;
      if (outcome === 'PENDING') outcome = 'LOST';
    }
    if (b.winning_bid_amount != null) winnerAmount = Number(b.winning_bid_amount);

    const amount = Number(b.amount ?? b.bid_amount ?? 0);
    const period = Number(b.period ?? b.delivery_days ?? 0);

    const submittedRaw = b.time_submitted ?? b.submit_date ?? b.time_created;
    let submittedAt: string | null = null;
    if (typeof submittedRaw === 'number') {
      submittedAt = new Date(submittedRaw > 1e12 ? submittedRaw : submittedRaw * 1000).toISOString();
    } else if (typeof submittedRaw === 'string' && submittedRaw) {
      submittedAt = new Date(submittedRaw).toISOString();
    }

    const awardedRaw = b.time_awarded ?? b.awarded_date;
    let awardedAt: string | null = null;
    if (typeof awardedRaw === 'number') {
      awardedAt = new Date(awardedRaw > 1e12 ? awardedRaw : awardedRaw * 1000).toISOString();
    } else if (typeof awardedRaw === 'string' && awardedRaw) {
      awardedAt = new Date(awardedRaw).toISOString();
    }

    return {
      bidId: b.id,
      projectId: b.project_id || project.id,
      projectTitle: project.title || b.project_title || `Project #${b.project_id}`,
      seoUrl: project.seo_url || b.seo_url || '',
      amount,
      period,
      description: (b.description || '').slice(0, 2000),
      awardStatus: b.award_status || b.frontend_bid_status || b.front_bid_status || b.status || null,
      outcome,
      clientViewed,
      profileViewed,
      winnerAmount,
      submittedAt,
      awardedAt,
      projectStatus: project.status || project.frontend_project_status || null,
      bidCount: project.bid_stats?.bid_count ?? project.bid_count ?? null,
      avgBid: project.bid_stats?.bid_avg ?? null,
      currency: b.currency?.code || project.currency?.code || 'USD',
      rawAwardStatus: awardJoined || null,
    };
  }

  async markAwardedToOther(
    freelancerProjId: string,
    winner: { bidPrice: number; rating?: number; reviewsCount?: number },
  ) {
    const app = await this.db.application.findUnique({
      where: { freelancerProjId },
    });
    if (!app || app.status === 'ADJUDICADO_A_MIME') return null;

    return this.db.application.update({
      where: { id: app.id },
      data: {
        status: 'ADJUDICADO_A_OTRO' as BidStatus,
        winnerBidPrice: winner.bidPrice,
        winnerRating: winner.rating,
        winnerReviewsCount: winner.reviewsCount,
      },
    });
  }
}
