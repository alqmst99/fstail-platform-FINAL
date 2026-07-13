// src/audit/audit.controller.ts
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
import { AuditService } from './audit.service';
import {
  CreateAuditDto,
  UpdateAuditDto,
  UpdateAuditSectionsDto,
  QueryAuditsDto,
} from './dto/audit.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import type { AuthUser } from '@fstail/types';

@ApiTags('audits')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
@Controller('audits')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // GET /api/audits
  @Get()
  @ApiOperation({ summary: 'List audits — paginated, filterable by status / client / project' })
  findAll(
    @Query() query: QueryAuditsDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.auditService.findAll(workspaceId, query);
  }

  // GET /api/audits/stats
  @Get('stats')
  @ApiOperation({ summary: 'Audit counts by status and avg score' })
  getStats(@CurrentUser('workspaceId') workspaceId: string) {
    return this.auditService.getStats(workspaceId);
  }

  // GET /api/audits/templates
  @Get('templates')
  @ApiOperation({ summary: 'List available audit templates' })
  findTemplates() {
    return this.auditService.findTemplates();
  }

  // GET /api/audits/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get audit with sections and live score calculation' })
  @ApiResponse({ status: 404, description: 'Audit not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.auditService.findOne(id, workspaceId);
  }

  // POST /api/audits
  @Post()
  @ApiOperation({ summary: 'Create a new audit from a template' })
  create(
    @Body() dto: CreateAuditDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auditService.create(dto, user.workspaceId!, user.id);
  }

  // PATCH /api/audits/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update audit metadata (title, status, client, project)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuditDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.auditService.update(id, dto, workspaceId);
  }

  // PATCH /api/audits/:id/sections
  @Patch(':id/sections')
  @ApiOperation({
    summary: 'Save section scores and observations — uses optimistic locking',
    description:
      'Include the current `version` from GET /audits/:id. ' +
      'If another user saved in the meantime, a 409 Conflict is returned.',
  })
  @ApiResponse({ status: 409, description: 'Version conflict — reload and retry' })
  updateSections(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuditSectionsDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.auditService.updateSections(id, dto, workspaceId);
  }

  // POST /api/audits/:id/submit
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark audit as DONE — calculates final score' })
  @ApiResponse({ status: 400, description: 'No sections scored' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.auditService.submit(id, workspaceId);
  }

  // DELETE /api/audits/:id  (ADMIN+)
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an audit (ADMIN+)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.auditService.remove(id, workspaceId);
  }
}
