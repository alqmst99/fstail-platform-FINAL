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
  Req,
} from '@nestjs/common';
import { DailyTasksService } from './daily-tasks.service';
import { CreateDailyTaskDto, UpdateDailyTaskDto, QueryDailyTasksDto } from './dto/daily-task.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('daily-tasks')
@UseGuards(JwtAuthGuard)
export class DailyTasksController {
  constructor(private readonly service: DailyTasksService) {}

  @Post()
  create(@Body() dto: CreateDailyTaskDto, @Req() req: any) {
    return this.service.create(dto, req.user.workspaceId);
  }

  @Post('import-routine')
  importRoutine(@Body() body: any, @Req() req: any) {
    return this.service.importRoutine(req.user.workspaceId, body);
  }

  @Post('import-routine-week')
  importRoutineWeek(@Body() body: any, @Req() req: any) {
    return this.service.importRoutineWeek(req.user.workspaceId, body);
  }

  @Get('range')
  findRange(
    @Query('userTag') userTag: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    return this.service.findByRange(req.user.workspaceId, {
      userTag: userTag || 'Dev1',
      from,
      to,
    });
  }

  @Get()
  find(@Query() query: QueryDailyTasksDto, @Req() req: any) {
    return this.service.findByUserAndDate(req.user.workspaceId, query);
  }

  @Get('routine-context')
  getRoutineContext(@Query('userTag') userTag: string, @Req() req: any) {
    return this.service.buildRoutineContext(req.user.workspaceId, userTag || 'Dev1');
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDailyTaskDto, @Req() req: any) {
    return this.service.update(id, req.user.workspaceId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.workspaceId);
  }
}
