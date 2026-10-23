import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FreelancerAuthClient } from '../radar/freelancer-auth.client';
import type { BidStatus } from './applications.service';

/**
 * Sincroniza adjudicaciones de postulaciones abiertas.
 *
 * Evita martillar GET /projects/{id} (muchas devuelven NOT_FOUND o 500 en FL).
 * Preferimos el listado de TUS bids (getMyBids) y solo caemos a getProject
 * cuando hace falta detalle de selected_bids.
 */
@Injectable()
export class AwardMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AwardMonitorService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 5 * 60 * 1000;
  private readonly FAILED_PROJECT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h para NOT_FOUND
  private readonly failedProjects = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly freelancer: FreelancerAuthClient,
  ) {}

  private get db() {
    return this.prisma as PrismaService & { application: any };
  }

  onModuleInit() {
    if (this.freelancer.isConfigured()) {
      this.logger.log(`Award monitor started (every ${this.INTERVAL_MS / 1000}s)`);
      this.timer = setInterval(() => this.syncAll().catch((e) => this.logger.error(e)), this.INTERVAL_MS);
      setTimeout(() => this.syncAll().catch(() => {}), 30_000);
    } else {
      this.logger.warn('Award monitor disabled — Freelancer OAuth not configured');
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async syncAll() {
    if (!this.freelancer.isConfigured()) return { checked: 0, updated: 0 };

    const open = await this.db.application.findMany({
      where: {
        status: { in: ['POSTULADO', 'EN_CONVERSACION'] as BidStatus[] },
      },
      take: 60,
      orderBy: { updatedAt: 'asc' },
    });

    // 1) Bulk: mapear award status desde TUS bids (1–2 requests vs N getProject)
    let bidByProject = new Map<string, any>();
    try {
      const myBids = await this.freelancer.fetchAllMyBids(150);
      for (const b of myBids) {
        const pid = String(b.project_id ?? b.project?.id ?? '');
        if (pid) bidByProject.set(pid, b);
      }
    } catch (e: any) {
      this.logger.warn(`fetchAllMyBids failed, fallback getProject: ${e.message}`);
    }

    let updated = 0;
    let checked = 0;

    for (const app of open) {
      const pid = String(app.freelancerProjId);
      const retryAfter = this.failedProjects.get(pid);
      if (retryAfter && retryAfter > Date.now()) continue;
      if (retryAfter) this.failedProjects.delete(pid);

      checked++;
      try {
        const myBid = bidByProject.get(pid);
        let changed = false;

        if (myBid) {
          changed = await this.applyFromMyBid(app.id, pid, myBid);
        } else {
          // Sin bid en el listado: intentar detalle (puede ser proyecto borrado)
          changed = await this.checkOne(pid, app.id);
        }

        this.failedProjects.delete(pid);
        if (changed) updated++;
      } catch (err: any) {
        const msg = String(err?.message || err);
        const isGone =
          /not_found|doesn't exist|object doesn't exist|404/i.test(msg) ||
          /unknown error/i.test(msg);

        this.failedProjects.set(
          pid,
          Date.now() + (isGone ? this.FAILED_PROJECT_COOLDOWN_MS : 30 * 60 * 1000),
        );

        // Proyecto inexistente en FL → cerrar postulación local para no reintentar cada 5 min
        if (/not_found|doesn't exist|object doesn't exist/i.test(msg)) {
          try {
            await this.db.application.update({
              where: { id: app.id },
              data: { status: 'CANCELADO' as BidStatus },
            });
            updated++;
            this.logger.debug(`Project ${pid} gone on FL → marked CANCELADO`);
          } catch {
            /* ignore */
          }
        } else {
          this.logger.debug(`Skip project ${pid}: ${msg}`);
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    this.logger.log(`Award sync: checked ${checked}, updated ${updated}`);
    return { checked, updated };
  }

  /** Aplica estado desde un bid propio (respuesta de getMyBids). */
  private async applyFromMyBid(applicationId: string, freelancerProjId: string, bid: any): Promise<boolean> {
    const project = bid.project || {};
    const myUserId = Number(process.env.FREELANCER_USER_ID);

    const awardJoined = [
      bid.award_status,
      bid.frontend_bid_status,
      bid.front_bid_status,
      bid.bid_status,
      bid.status,
    ]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase())
      .join(' ');

    const selectedList = Array.isArray(project.selected_bids)
      ? project.selected_bids
      : project.selected_bids
        ? [project.selected_bids]
        : [];
    const selected = selectedList[0];
    const selectedBidder = Number(selected?.bidder_id || selected?.user_id || 0);
    const selectedId = Number(selected?.id || 0);

    let status: BidStatus | null = null;
    let winnerBidPrice: number | undefined;
    let winnerRating: number | undefined;
    let winnerReviewsCount: number | undefined;

    const won =
      (awardJoined.includes('awarded') && !awardJoined.includes('not_awarded')) ||
      (selectedId > 0 && Number(bid.id) === selectedId) ||
      (selectedBidder > 0 && selectedBidder === myUserId);

    const lost =
      awardJoined.includes('not_awarded') ||
      awardJoined.includes('reject') ||
      awardJoined.includes('lost') ||
      (selectedBidder > 0 && selectedBidder !== myUserId) ||
      (selectedId > 0 && Number(bid.id) !== selectedId);

    const retracted =
      awardJoined.includes('retract') ||
      awardJoined.includes('withdraw') ||
      !!bid.retracted;

    const pStatus = String(project.status || project.frontend_project_status || '').toLowerCase();
    const closed = ['closed', 'completed', 'cancelled', 'canceled', 'deleted'].includes(pStatus);

    if (won) {
      status = 'ADJUDICADO_A_MIME';
      winnerBidPrice = Number(bid.amount || bid.bid_amount || 0) || undefined;
    } else if (lost || (closed && selectedBidder && selectedBidder !== myUserId)) {
      status = 'ADJUDICADO_A_OTRO';
      const amount = Number(selected?.amount || selected?.bid_amount || 0);
      if (amount) winnerBidPrice = amount;
      const rep = selected?.bidder?.reputation || selected?.reputation || {};
      winnerRating = Number(rep.overall || rep.rating || 0) || undefined;
      winnerReviewsCount = Number(rep.reviews || rep.review_count || 0) || undefined;
    } else if (retracted || (closed && !selectedBidder && !won)) {
      status = closed ? 'NO_ADJUDICADO' : 'CANCELADO';
    }

    if (!status) return false;

    await this.db.application.update({
      where: { id: applicationId },
      data: {
        status,
        ...(winnerBidPrice != null ? { winnerBidPrice } : {}),
        ...(winnerRating != null ? { winnerRating } : {}),
        ...(winnerReviewsCount != null ? { winnerReviewsCount } : {}),
      },
    });
    this.logger.log(`Award ${status} project ${freelancerProjId}`);
    return true;
  }

  async checkOne(freelancerProjId: string, applicationId: string): Promise<boolean> {
    const data = await this.freelancer.getProject(freelancerProjId);
    const project =
      data?.result?.projects?.[freelancerProjId] ||
      data?.result?.projects?.[String(freelancerProjId)] ||
      data?.result ||
      data;

    if (!project || (typeof project === 'object' && !project.status && !project.title && !project.id)) {
      // Respuesta vacía / no usable
      throw new Error("Object doesn't exist");
    }

    const status = String(project.status || project.project_status || '').toLowerCase();
    const selectedBids = project.selected_bids || project.bid_stats?.selected || [];

    if (['closed', 'cancelled', 'canceled', 'rejected', 'deleted'].includes(status) && !selectedBids?.length) {
      await this.db.application.update({
        where: { id: applicationId },
        data: { status: 'NO_ADJUDICADO' as BidStatus },
      });
      return true;
    }

    if (!selectedBids || (Array.isArray(selectedBids) && selectedBids.length === 0)) {
      return false;
    }

    const bids = Array.isArray(selectedBids) ? selectedBids : Object.values(selectedBids);
    const myUserId = Number(process.env.FREELANCER_USER_ID);

    let wonByMe = false;
    let winnerBidPrice: number | undefined;
    let winnerRating: number | undefined;
    let winnerReviewsCount: number | undefined;

    for (const bid of bids as any[]) {
      const bidderId = Number(bid.bidder_id || bid.user_id || bid.freelancer_id);
      const amount = Number(bid.amount || bid.bid_amount || 0);

      if (bidderId === myUserId) {
        wonByMe = true;
        winnerBidPrice = amount;
      } else {
        winnerBidPrice = amount;
        const rep = bid.bidder?.reputation || bid.reputation || {};
        winnerRating = Number(rep.overall || rep.rating || 0) || undefined;
        winnerReviewsCount = Number(rep.reviews || rep.review_count || 0) || undefined;
      }
    }

    if (wonByMe) {
      await this.db.application.update({
        where: { id: applicationId },
        data: {
          status: 'ADJUDICADO_A_MIME' as BidStatus,
          winnerBidPrice,
        },
      });
      this.logger.log(`Won project ${freelancerProjId}`);
      return true;
    }

    if (winnerBidPrice != null) {
      await this.db.application.update({
        where: { id: applicationId },
        data: {
          status: 'ADJUDICADO_A_OTRO' as BidStatus,
          winnerBidPrice,
          winnerRating,
          winnerReviewsCount,
        },
      });
      this.logger.log(`Lost project ${freelancerProjId} → winner $${winnerBidPrice}`);
      return true;
    }

    return false;
  }
}
