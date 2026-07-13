// src/workspaces/workspaces.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import {
  UpdateWorkspaceDto,
  TransferOwnershipDto,
  UpdatePlanDto,
} from './dto/workspace.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import type { AuthUser } from '@fstail/types';

@ApiTags('workspaces')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  // GET /api/workspaces/me — current user's workspace
  @Get('me')
  @ApiOperation({ summary: 'Get current workspace with member and usage counts' })
  getMyWorkspace(@CurrentUser('workspaceId') workspaceId: string) {
    return this.workspacesService.findOne(workspaceId);
  }

  // GET /api/workspaces/me/stats
  @Get('me/stats')
  @ApiOperation({ summary: 'Workspace usage statistics — totals and last 30 days' })
  getStats(@CurrentUser('workspaceId') workspaceId: string) {
    return this.workspacesService.getStats(workspaceId);
  }

  // PATCH /api/workspaces/me — ADMIN+
  @Patch('me')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update workspace name, slug, or settings (ADMIN+)' })
  update(
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.update(user.workspaceId!, dto, user.id);
  }

  // POST /api/workspaces/me/transfer — owner only
  @Post('me/transfer')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Transfer workspace ownership to another member' })
  transferOwnership(
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.transferOwnership(
      user.workspaceId!,
      dto,
      user.id,
    );
  }

  // PATCH /api/workspaces/:id/plan — SUPER_ADMIN only
  @Patch(':id/plan')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Change workspace plan (SUPER_ADMIN only)' })
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.workspacesService.updatePlan(id, dto);
  }

  // DELETE /api/workspaces/:id — SUPER_ADMIN only
  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a workspace and revoke all sessions (SUPER_ADMIN only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspacesService.remove(id);
  }
}
