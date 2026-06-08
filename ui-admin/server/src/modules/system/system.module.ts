import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { ServicesModule } from '../services/services.module';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';

@Module({
  imports: [DockerModule, ServicesModule],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
