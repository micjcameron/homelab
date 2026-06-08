import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEntity } from './device.entity';
import { DeviceRepository } from './device.repository';
import { PiholeClient } from './pihole.client';
import { NetworkService } from './network.service';
import { NetworkController } from './network.controller';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceEntity]),
    forwardRef(() => TelegramModule),
  ],
  controllers: [NetworkController],
  providers: [DeviceRepository, PiholeClient, NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}
