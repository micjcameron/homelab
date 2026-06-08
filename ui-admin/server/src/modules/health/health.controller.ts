import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/guards/auth.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
