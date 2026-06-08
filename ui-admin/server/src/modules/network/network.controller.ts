import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NetworkService } from './network.service';
import { ApproveDto, RenameDto } from './dto/device.dto';

@ApiTags('network')
@Controller('network')
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Get('devices')
  list() {
    return this.network.list();
  }

  @Get('devices/:mac/detail')
  detail(@Param('mac') mac: string) {
    return this.network.detail(mac.toLowerCase());
  }

  @Post('devices/:mac/approve')
  approve(@Param('mac') mac: string, @Body() dto: ApproveDto) {
    return this.network.approve(mac.toLowerCase(), dto?.preferredName);
  }

  @Put('devices/:mac/name')
  rename(@Param('mac') mac: string, @Body() dto: RenameDto) {
    return this.network.rename(mac.toLowerCase(), dto.preferredName);
  }

  @Post('devices/:mac/block')
  block(@Param('mac') mac: string) {
    return this.network.block(mac.toLowerCase());
  }
}
