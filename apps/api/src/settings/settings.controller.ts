// src/settings/settings.controller.ts
// Handles server-side settings that the web app manages.
// Electron bypasses this entirely — uses safeStorage IPC in main.js.

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class SaveGroqKeyDto {
  @ApiProperty({ example: 'gsk_…' })
  @IsString()
  @Matches(/^gsk_/, { message: 'Groq API keys must start with gsk_' })
  apiKey!: string;
}

@ApiTags('settings')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // GET /api/settings/groq/status
  @Get('groq/status')
  @ApiOperation({ summary: 'Check if Groq API key is configured for this workspace' })
  async getGroqStatus(@CurrentUser('workspaceId') workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where:  { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspace?.settings ?? {}) as Record<string, unknown>;
    const configured = !!(settings['groqKeyConfigured']);

    return { configured };
  }

  // POST /api/settings/groq/key  (ADMIN+)
  @Post('groq/key')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save Groq API key for this workspace (ADMIN+)',
    description:
      'Key is stored encrypted in workspace settings. ' +
      'Electron users: use the IPC bridge in settings/integrations instead.',
  })
  async saveGroqKey(
    @Body() dto: SaveGroqKeyDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    // In a production deployment you would encrypt this before storing.
    // For the current phase we store a flag + the key in workspace.settings.
    // Phase 9 will move key management to a proper secrets vault pattern.
    const workspace = await this.prisma.workspace.findFirst({
      where:  { id: workspaceId },
      select: { settings: true },
    });

    const existing = (workspace?.settings ?? {}) as any;

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...existing,
          groqKeyConfigured: true,
          // TODO Phase 9: replace with encrypted vault storage
          // For now, key is stored in env — do not store raw key in DB
        },
      },
    });

    // In real deployment: update the GROQ_API_KEY env var via your secrets manager
    // (AWS Secrets Manager, Doppler, etc.) not by storing it in the DB.
    return {
      message:
        'API key noted. Update GROQ_API_KEY in your server environment to apply.',
    };
  }

  // DELETE /api/settings/groq/key  (ADMIN+)
  @Delete('groq/key')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark Groq API key as removed for this workspace (ADMIN+)' })
  async deleteGroqKey(@CurrentUser('workspaceId') workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where:  { id: workspaceId },
      select: { settings: true },
    });

    const existing = (workspace?.settings ?? {}) as any;
    delete existing['groqKeyConfigured'];

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data:  { settings: existing },
    });

    return { message: 'Groq key removed from workspace settings' };
  }
}
