// src/clients/clients.controller.ts
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
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, QueryClientsDto } from './dto/client.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'CLIENT';
import type { AuthUser } from '@fstail/types';

@ApiTags('clients')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RbacGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // GET /api/clients
  @Get()
  @ApiOperation({ summary: 'List clients — paginated, filterable, searchable' })
  findAll(
    @Query() query: QueryClientsDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.clientsService.findAll(workspaceId, query);
  }

  // GET /api/clients/stats
  @Get('stats')
  @ApiOperation({ summary: 'Client counts by status' })
  getStats(@CurrentUser('workspaceId') workspaceId: string) {
    return this.clientsService.getStats(workspaceId);
  }

  // GET /api/clients/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get client with projects and recent audits' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.clientsService.findOne(id, workspaceId);
  }

  // POST /api/clients
  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  @ApiResponse({ status: 201 })
  create(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.create(dto, user.workspaceId!, user.id);
  }

  // PATCH /api/clients/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update a client' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.clientsService.update(id, dto, workspaceId);
  }

  // DELETE /api/clients/:id  (soft delete — ADMIN+)
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a client (ADMIN+)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.remove(id, user.workspaceId!, user);
  }
}
