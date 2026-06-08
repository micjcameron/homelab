import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { ServicesService } from '../services/services.service';

@ApiTags('system')
@Controller('system')
export class SystemController {
  constructor(
    private readonly system: SystemService,
    private readonly services: ServicesService,
  ) {}

  @Get()
  getHealth() {
    return this.system.getHealth();
  }

  @Get('summary')
  async summary() {
    const [system, services] = await Promise.all([
      this.system.getHealth(),
      this.services.getAllStatus(),
    ]);
    return { system, services };
  }
}
