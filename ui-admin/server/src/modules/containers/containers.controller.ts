import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContainersService } from './containers.service';

@ApiTags('containers')
@Controller('containers')
export class ContainersController {
  constructor(private readonly containers: ContainersService) {}

  @Get()
  list() {
    return this.containers.list();
  }
}
