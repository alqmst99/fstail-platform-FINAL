import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule], // ReportsService uses calculateScore from audit module
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
