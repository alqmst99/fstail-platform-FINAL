import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    // Logging configured via PRISMA_QUERY_LOG env var in production
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }

  /**
   * Soft-delete helper — sets deleted_at instead of removing the row.
   * Usage: await this.prisma.softDelete('client', { id: clientId })
   */
  async softDelete(model: string, where: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any)[model].update({
      where,
      data: { deletedAt: new Date() },
    });
  }
}
