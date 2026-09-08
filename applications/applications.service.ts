import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FreelancerAuthClient } from '../radar/freelancer-auth.client';
import {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  CreateMessageDto,
  QueryApplicationsDto,
} from './dto/application.dto';
import { BidStatus } from '@prisma/client';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly freelancer: FreelancerAuthClient,
  ) {}

  /**
   * Place bid on Freelancer (if OAuth configured) + persist Application.
   */
  async create(dto: CreateApplicationDto, workspaceId: string) {
    // 1. Real bid via Developer API (optional but preferred)
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
        // Still save locally so operator can retry / track
        throw new BadRequestException(
          `No se pudo postular en Freelancer: ${err.message}. Revisá OAuth y cupo de bids.`,
        );
      }
    } else {
      this.logger.warn('Freelancer OAuth off — saving Application only (no real bid)');
    }

    // 2. Persist
    const app = await this.prisma.application.create({
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
        status: BidStatus.POSTULADO,
      },
    });

    this.logger.log(`Application saved: ${app.id}`);
    return app;
  }

  async findAll(workspaceId: string, query: QueryApplicationsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = { workspaceId };

    if (query.status) {
      const statuses = query.status.split(',').map((s) => s.trim()) as BidStatus[];
      where.status = { in: statuses };
    }

    if (query.assignedTo) {
      where.assignedToUserTag = query.assignedTo;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          messages: { orderBy: { timestamp: 'desc' }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.application.count({ where }),
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
    const app = await this.prisma.application.findFirst({
      where: { id, workspaceId },
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async updateStatus(id: string, workspaceId: string, dto: UpdateApplicationStatusDto) {
    await this.findOne(id, workspaceId);
    return this.prisma.application.update({
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

    // Push to Freelancer if configured and sender is me
    if (dto.sender === 'me' && this.freelancer.isConfigured()) {
      try {
        await this.freelancer.sendMessage(Number(app.freelancerProjId), dto.text);
      } catch (err: any) {
        this.logger.warn(`Could not push message to Freelancer: ${err.message}`);
      }
    }

    const message = await this.prisma.message.create({
      data: {
        applicationId,
        sender: dto.sender,
        text: dto.text,
        externalId: dto.externalId,
      },
    });

    if (dto.sender === 'client') {
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { status: BidStatus.EN_CONVERSACION },
      });
    }

    return message;
  }

  async markAwardedToOther(
    freelancerProjId: string,
    winner: { bidPrice: number; rating?: number; reviewsCount?: number },
  ) {
    const app = await this.prisma.application.findUnique({
      where: { freelancerProjId },
    });
    if (!app || app.status === BidStatus.ADJUDICADO_A_MIME) return null;

    return this.prisma.application.update({
      where: { id: app.id },
      data: {
        status: BidStatus.ADJUDICADO_A_OTRO,
        winnerBidPrice: winner.bidPrice,
        winnerRating: winner.rating,
        winnerReviewsCount: winner.reviewsCount,
      },
    });
  }
}
