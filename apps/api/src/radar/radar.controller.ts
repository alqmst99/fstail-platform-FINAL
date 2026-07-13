// src/radar/radar.controller.ts
import {
  Controller,
  Get,
  Post,
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
import { Throttle } from '@nestjs/throttler';
import { RadarService } from './radar.service';
import {
  ScanDto,
  GenerateProposalDto,
  QueryScansDto,
  QueryProposalsDto,
} from './dto/radar.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@fstail/types';

@ApiTags('radar')
@ApiCookieAuth('accessToken')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('radar')
export class RadarController {
  constructor(private readonly radarService: RadarService) {}

  // ── Stats ─────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Radar usage stats — scan count, proposal count, framework breakdown' })
  getStats(@CurrentUser('workspaceId') workspaceId: string) {
    return this.radarService.getStats(workspaceId);
  }

  // ── Scans ─────────────────────────────────────────────────────────

  @Post('scan')
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // max 10 scans / min
  @ApiOperation({ summary: 'Scan Freelancer.com for active projects' })
  @ApiResponse({ status: 201, description: 'Scan complete — returns filtered project list' })
  scan(
    @Body() dto: ScanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.radarService.scan(dto, user.workspaceId!, user.id);
  }

  @Get('scans')
  @ApiOperation({ summary: 'List past scans' })
  findScans(
    @Query() query: QueryScansDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.radarService.findScans(workspaceId, query);
  }

  @Get('scans/:id')
  @ApiOperation({ summary: 'Get a scan with its projects and linked proposals' })
  findScan(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.radarService.findScan(id, workspaceId);
  }

  // ── Proposals ─────────────────────────────────────────────────────

  @Post('proposals/generate')
  @Throttle({ default: { ttl: 60_000, limit: 20 } }) // 20 proposals / min
  @ApiOperation({ summary: 'Generate an AI proposal for a scanned project using Groq' })
  @ApiResponse({ status: 201, description: 'Proposal generated and saved' })
  @ApiResponse({ status: 503, description: 'Groq API unavailable' })
  generateProposal(
    @Body() dto: GenerateProposalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.radarService.generateProposal(dto, user.workspaceId!, user.id);
  }

  @Get('proposals')
  @ApiOperation({ summary: 'List saved proposals — filterable by framework and scan' })
  findProposals(
    @Query() query: QueryProposalsDto,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.radarService.findProposals(workspaceId, query);
  }

  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get a single proposal' })
  findProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.radarService.findProposal(id, workspaceId);
  }

  @Delete('proposals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a proposal' })
  deleteProposal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('workspaceId') workspaceId: string,
  ) {
    return this.radarService.deleteProposal(id, workspaceId);
  }
}
