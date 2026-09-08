import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { AwardMonitorService } from './award-monitor.service';
import {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  CreateMessageDto,
  QueryApplicationsDto,
} from './dto/application.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(
    private readonly service: ApplicationsService,
    private readonly awardMonitor: AwardMonitorService,
  ) {}

  @Post()
  create(@Body() dto: CreateApplicationDto, @Req() req: any) {
    return this.service.create(dto, req.user.workspaceId);
  }

  @Get()
  findAll(@Query() query: QueryApplicationsDto, @Req() req: any) {
    return this.service.findAll(req.user.workspaceId, query);
  }

  /** Manual trigger for award sync — MUST be before :id routes */
  @Post('sync-awards')
  syncAwards() {
    return this.awardMonitor.syncAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user.workspaceId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: any,
  ) {
    return this.service.updateStatus(id, req.user.workspaceId, dto);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @Req() req: any,
  ) {
    return this.service.addMessage(id, req.user.workspaceId, dto);
  }
}
