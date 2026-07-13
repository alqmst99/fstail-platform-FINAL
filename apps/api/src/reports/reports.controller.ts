// src/reports/reports.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  UpdateReportDto,
  PublishReportDto,
  QueryReportsDto,
} from './dto/report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import type { AuthUser } from '@fstail/types';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ── Authenticated routes ───────────────────────────────────────────

  @Get()
  @ApiCookieAuth('accessToken')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
  @ApiOperation({ summary: 'List reports for the workspace' })
  findAll(
    @Query() query: QueryReportsDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.reportsService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiCookieAuth('accessToken')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
  @ApiOperation({ summary: 'Get a report with full content blocks' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.reportsService.findOne(id, workspaceId);
  }

  @Post()
  @ApiCookieAuth('accessToken')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
  @ApiOperation({ summary: 'Create a report — optionally auto-built from audit IDs' })
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reportsService.create(dto, user.workspaceId!, user.id);
  }

  @Patch(':id')
  @ApiCookieAuth('accessToken')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
  @ApiOperation({ summary: 'Update report title or content blocks' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.reportsService.update(id, dto, workspaceId);
  }

  @Post(':id/publish')
  @ApiCookieAuth('accessToken')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a time-limited public portal link' })
  @ApiResponse({ status: 200, description: 'Returns portalUrl and expiresAt' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishReportDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.reportsService.publish(id, dto, workspaceId);
  }

  @Post(':id/unpublish')
  @ApiCookieAuth('accessToken')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the public portal link' })
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.reportsService.unpublish(id, workspaceId);
  }

  @Delete(':id')
  @ApiCookieAuth('accessToken')
  @UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a report (ADMIN+)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.reportsService.remove(id, workspaceId);
  }

  // ── Public portal route — NO auth ─────────────────────────────────

  @Public()
  @Get('portal/:token')
  @ApiOperation({
    summary: 'Public client portal — access report by time-limited token (no auth required)',
  })
  @ApiResponse({ status: 200, description: 'Report content for client view' })
  @ApiResponse({ status: 404, description: 'Invalid or removed link' })
  @ApiResponse({ status: 403, description: 'Expired link' })
  getPortal(@Param('token') token: string) {
    return this.reportsService.findByPortalToken(token);
  }
}
