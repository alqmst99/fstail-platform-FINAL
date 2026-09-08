import { Module } from '@nestjs/common';
import { DailyTasksService } from './daily-tasks.service';
import { DailyTasksController } from './daily-tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DailyTasksController],
  providers: [DailyTasksService],
  exports: [DailyTasksService],
})
export class DailyTasksModule {}
