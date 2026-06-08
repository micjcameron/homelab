import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { ServiceRegistryService } from './service-registry.service';
import { SpecialChecksService } from './special-checks.service';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';

@Module({
  imports: [DockerModule],
  controllers: [ServicesController],
  providers: [ServiceRegistryService, SpecialChecksService, ServicesService],
  exports: [ServicesService, ServiceRegistryService],
})
export class ServicesModule {}
