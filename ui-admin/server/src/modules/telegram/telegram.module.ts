import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServicesModule } from '../services/services.module';
import { SystemModule } from '../system/system.module';
import { NetworkModule } from '../network/network.module';
import { TelegramApi } from './telegram.api';
import { TelegramCommandService } from './telegram.command.service';
import { TelegramPollerService } from './telegram.poller.service';

@Module({
  imports: [
    ConfigModule,
    ServicesModule,
    SystemModule,
    forwardRef(() => NetworkModule),
  ],
  providers: [
    {
      provide: TelegramApi,
      useFactory: (config: ConfigService) =>
        new TelegramApi(config.get<string>('app.telegramBotToken', '')),
      inject: [ConfigService],
    },
    TelegramCommandService,
    TelegramPollerService,
  ],
  exports: [TelegramApi, TelegramCommandService],
})
export class TelegramModule {}
