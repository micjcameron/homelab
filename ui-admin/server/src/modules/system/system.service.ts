import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { execFile } from 'child_process';
import * as os from 'os';
import { DockerCliService } from '../docker/docker-cli.service';

export interface SystemHealth {
  uptimeSeconds: number | null;
  tempC: number | null;
  cpuCount: number;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  memory: { totalMb: number; usedMb: number; usedPct: number } | null;
  disk: { totalGb: number; usedGb: number; usedPct: number } | null;
  dockerOk: boolean;
}

/**
 * Host metrics — parity with lifeline_daily.sh. Reads /proc + /sys (which reflect
 * the host kernel even from inside the container) and `df` on the mounted host fs.
 */
@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly hostFsPath: string;

  constructor(
    private readonly config: ConfigService,
    private readonly docker: DockerCliService,
  ) {
    this.hostFsPath = this.config.get<string>('app.hostFsPath', '/host-home');
  }

  async getHealth(): Promise<SystemHealth> {
    const [uptimeSeconds, temp, load, memory, disk, dockerOk] =
      await Promise.all([
        this.uptime(),
        this.tempC(),
        this.loadAvg(),
        this.memory(),
        this.disk(),
        this.dockerOk(),
      ]);
    return {
      uptimeSeconds,
      tempC: temp,
      cpuCount: os.cpus().length || 1,
      load1: load?.[0] ?? null,
      load5: load?.[1] ?? null,
      load15: load?.[2] ?? null,
      memory,
      disk,
      dockerOk,
    };
  }

  private async uptime(): Promise<number | null> {
    try {
      const raw = await readFile('/proc/uptime', 'utf8');
      return Math.round(parseFloat(raw.split(' ')[0]));
    } catch {
      return null;
    }
  }

  private async tempC(): Promise<number | null> {
    try {
      const raw = await readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
      return Math.round((parseInt(raw.trim(), 10) / 1000) * 10) / 10;
    } catch {
      return null;
    }
  }

  private async loadAvg(): Promise<number[] | null> {
    try {
      const raw = await readFile('/proc/loadavg', 'utf8');
      return raw.split(' ').slice(0, 3).map(Number);
    } catch {
      return null;
    }
  }

  private async memory(): Promise<SystemHealth['memory']> {
    try {
      const raw = await readFile('/proc/meminfo', 'utf8');
      const get = (k: string) =>
        parseInt(raw.match(new RegExp(`${k}:\\s+(\\d+)`))?.[1] ?? '0', 10);
      const totalKb = get('MemTotal');
      const availKb = get('MemAvailable');
      if (!totalKb) return null;
      const totalMb = Math.round(totalKb / 1024);
      const usedMb = Math.round((totalKb - availKb) / 1024);
      return { totalMb, usedMb, usedPct: Math.round((usedMb / totalMb) * 100) };
    } catch {
      return null;
    }
  }

  private disk(): Promise<SystemHealth['disk']> {
    return new Promise((resolve) => {
      execFile('df', ['-k', this.hostFsPath], (err, stdout) => {
        if (err) return resolve(null);
        const line = stdout.trim().split('\n').pop() ?? '';
        const cols = line.split(/\s+/);
        // Filesystem 1K-blocks Used Available Use% Mounted
        const totalKb = parseInt(cols[1], 10);
        const usedKb = parseInt(cols[2], 10);
        if (!totalKb) return resolve(null);
        resolve({
          totalGb: Math.round((totalKb / 1024 / 1024) * 10) / 10,
          usedGb: Math.round((usedKb / 1024 / 1024) * 10) / 10,
          usedPct: Math.round((usedKb / totalKb) * 100),
        });
      });
    });
  }

  private async dockerOk(): Promise<boolean> {
    try {
      return await this.docker.ping();
    } catch {
      return false;
    }
  }
}
