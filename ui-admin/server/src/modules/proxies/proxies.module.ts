import { Module } from '@nestjs/common';
import { ProxiesService } from './proxies.service';
import { ProxiesController } from './proxies.controller';
import { CloudflareAccessService } from './cloudflare-access.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [ProxiesController],
  providers: [ProxiesService, CloudflareAccessService],
})
export class ProxiesModule {}
