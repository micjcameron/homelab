import { Module } from '@nestjs/common';
import { ProxiesService } from './proxies.service';
import { ProxiesController } from './proxies.controller';
import { CloudflareAccessService } from './cloudflare-access.service';

@Module({
  controllers: [ProxiesController],
  providers: [ProxiesService, CloudflareAccessService],
})
export class ProxiesModule {}
