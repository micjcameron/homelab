import { Injectable } from '@nestjs/common';
import { DockerCliService } from '../docker/docker-cli.service';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  state: string; // running | exited | created | ...
  status: string; // "Up 2 hours" / "Exited (0) 3 days ago"
  ports: string;
  networks: string;
  runningFor: string;
}

@Injectable()
export class ContainersService {
  constructor(private readonly docker: DockerCliService) {}

  async list(): Promise<ContainerInfo[]> {
    const raw = await this.docker.ps();
    return raw
      .map((c): ContainerInfo => ({
        id: (c.ID ?? '').slice(0, 12),
        name: c.Names ?? '',
        image: c.Image ?? '',
        state: (c.State ?? 'unknown').toLowerCase(),
        status: c.Status ?? '',
        ports: c.Ports ?? '',
        networks: c.Networks ?? '',
        runningFor: c.RunningFor ?? '',
      }))
      .sort((a, b) => {
        // running first, then by name
        const r = (a.state === 'running' ? 0 : 1) - (b.state === 'running' ? 0 : 1);
        return r || a.name.localeCompare(b.name);
      });
  }
}
