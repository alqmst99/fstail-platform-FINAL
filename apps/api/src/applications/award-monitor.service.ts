import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FreelancerAuthClient } from '../radar/freelancer-auth.client';
import type { BidStatus } from './applications.service';

@Injectable()
export class AwardMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AwardMonitorService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 5 * 60 * 1000;
  private readonly FAILED_PROJECT_COOLDOWN_MS = 30 * 60 * 1000;
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
      take: 40,
      orderBy: { updatedAt: 'asc' },
    });

    let updated = 0;
    for (const app of open) {
      const retryAfter = this.failedProjects.get(app.freelancerProjId);
      if (retryAfter && retryAfter > Date.now()) continue;
      if (retryAfter) this.failedProjects.delete(app.freelancerProjId);

      try {
        const changed = await this.checkOne(app.freelancerProjId, app.id);
        this.failedProjects.delete(app.freelancerProjId);
        if (changed) updated++;
      } catch (err: any) {
        this.failedProjects.set(
          app.freelancerProjId,
          Date.now() + this.FAILED_PROJECT_COOLDOWN_MS,
        );
        this.logger.debug(`Skip project ${app.freelancerProjId}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    this.logger.log(`Award sync: checked ${open.length}, updated ${updated}`);
    return { checked: open.length, updated };
  }

  async checkOne(freelancerProjId: string, applicationId: string): Promise<boolean> {
    const data = await this.freelancer.getProject(freelancerProjId);
    const project = data?.result?.projects?.[freelancerProjId] || data?.result || data;

    if (!project) return false;

    const status = String(project.status || project.project_status || '').toLowerCase();
    const selectedBids = project.selected_bids || project.bid_stats?.selected || [];

    if (['closed', 'cancelled', 'rejected', 'deleted'].includes(status) && !selectedBids?.length) {
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
