// src/projects/projects.controller.ts
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
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, QueryProjectsDto } from './dto/project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';

@ApiTags('projects')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List projects — paginated, filterable by status and client' })
  findAll(
    @Query() query: QueryProjectsDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.projectsService.findAll(workspaceId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Project counts by status' })
  getStats(@CurrentUser('workspaceId') workspaceId: string) {
    return this.projectsService.getStats(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project with client and audit history' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.projectsService.findOne(id, workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.projectsService.create(dto, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.projectsService.update(id, dto, workspaceId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a project (ADMIN+)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.projectsService.remove(id, workspaceId);
  }
}
