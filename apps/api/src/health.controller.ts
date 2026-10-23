import { Controller, Get, Head } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /** Render / uptime pegan a / — evita 404 ruidoso en logs */
  @Public()
  @Get()
  root() {
    return { status: 'ok', service: 'fstail-api' };
  }

  @Public()
  @Head()
  rootHead() {
    return;
  }
}
