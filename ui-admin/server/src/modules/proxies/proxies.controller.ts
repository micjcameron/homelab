import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProxiesService } from './proxies.service';

@ApiTags('proxies')
@Controller('proxies')
export class ProxiesController {
  constructor(private readonly proxies: ProxiesService) {}

  @Get()
  list() {
    return this.proxies.list();
  }
}
