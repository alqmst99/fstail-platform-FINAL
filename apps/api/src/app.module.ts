// src/app.module.ts — Phase 8 + Freelancer CRM / Daily Tasks

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { AuditModule } from './audit/audit.module';
import { RadarModule } from './radar/radar.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { ApplicationsModule } from './applications/applications.module';
import { DailyTasksModule } from './daily-tasks/daily-tasks.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '../.env', '.env', '../../apps/api/.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ClientsModule,
    ProjectsModule,
    AuditModule,
    RadarModule,
    ReportsModule,
    SettingsModule,
    ApplicationsModule,
    DailyTasksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
