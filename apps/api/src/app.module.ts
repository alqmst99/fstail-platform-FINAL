// src/app.module.ts — Phase 8 update
// Add WorkspacesModule and SettingsModule to the imports array.
// Replace the Phase 2 stub with this file.

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';   // Phase 8
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { AuditModule } from './audit/audit.module';
import { RadarModule } from './radar/radar.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';         // Phase 8
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,   // Phase 8
    ClientsModule,
    ProjectsModule,
    AuditModule,
    RadarModule,
    ReportsModule,
    SettingsModule,     // Phase 8
  ],
  controllers: [HealthController],
})
export class AppModule {}
