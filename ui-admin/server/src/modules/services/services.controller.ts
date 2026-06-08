import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list() {
    return this.services.getAllStatus();
  }

  @Get(':name')
  get(@Param('name') name: string) {
    return this.services.getStatus(name);
  }

  @Post(':name/restart')
  restart(@Param('name') name: string) {
    return this.services.restart(name);
  }

  @Post(':name/up')
  up(@Param('name') name: string) {
    return this.services.up(name);
  }

  @Post(':name/down')
  down(@Param('name') name: string) {
    return this.services.down(name);
  }

  @Get(':name/logs')
  logs(@Param('name') name: string, @Query('tail') tail?: string) {
    const n = tail ? Math.min(Math.max(parseInt(tail, 10) || 200, 1), 2000) : 200;
    return this.services.logs(name, n);
  }

  @Get(':name/check')
  check(@Param('name') name: string) {
    return this.services.check(name);
  }
}
