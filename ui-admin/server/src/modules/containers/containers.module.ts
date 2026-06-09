import { Module } from '@nestjs/common';
import { DockerModule } from '../docker/docker.module';
import { ContainersService } from './containers.service';
import { ContainersController } from './containers.controller';

@Module({
  imports: [DockerModule],
  controllers: [ContainersController],
  providers: [ContainersService],
})
export class ContainersModule {}
