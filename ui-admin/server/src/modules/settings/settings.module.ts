import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingEntity } from './setting.entity';
import { SettingRepository } from './setting.repository';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SettingEntity])],
  controllers: [SettingsController],
  providers: [SettingRepository, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
