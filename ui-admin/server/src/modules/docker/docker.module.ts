import { Module } from '@nestjs/common';
import { DockerCliService } from './docker-cli.service';

@Module({
  providers: [DockerCliService],
  exports: [DockerCliService],
})
export class DockerModule {}
