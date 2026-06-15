import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProxiesService } from './proxies.service';
import { GateDto } from './proxies.dto';

@ApiTags('proxies')
@Controller('proxies')
export class ProxiesController {
  constructor(private readonly proxies: ProxiesService) {}

  @Get()
  list() {
    return this.proxies.list();
  }

  /** Gate a proxy behind a Cloudflare Access email allowlist (create/replace). */
  @Post(':name/gate')
  gate(@Param('name') name: string, @Body() dto: GateDto) {
    return this.proxies.setGate(name, dto.emails);
  }

  /** Remove the gate — make the proxy public again. */
  @Delete(':name/gate')
  ungate(@Param('name') name: string) {
    return this.proxies.removeGate(name);
  }
}
