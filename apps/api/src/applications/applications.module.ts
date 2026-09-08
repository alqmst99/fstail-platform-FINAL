import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { AwardMonitorService } from './award-monitor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FreelancerAuthClient } from '../radar/freelancer-auth.client';

@Module({
  imports: [PrismaModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, AwardMonitorService, FreelancerAuthClient],
  exports: [ApplicationsService, AwardMonitorService],
})
export class ApplicationsModule {}
