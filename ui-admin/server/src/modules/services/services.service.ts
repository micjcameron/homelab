import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { DockerCliService } from '../docker/docker-cli.service';
import { ServiceRegistryService } from './service-registry.service';
import { SpecialChecksService } from './special-checks.service';
import {
  ActionResult,
  HealthState,
  ServiceLogs,
  ServiceState,
  ServiceStatus,
} from './services.types';

/**
 * The single source of truth for service control. Both the web controller and
 * (later) the Telegram handler call THESE methods — one code path, one
 * allow-list. Mirrors manage.sh / lifeline exactly.
 */
@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private readonly registry: ServiceRegistryService,
    private readonly docker: DockerCliService,
    private readonly specialChecks: SpecialChecksService,
  ) {}

  async getAllStatus(): Promise<ServiceStatus[]> {
    const defs = await this.registry.list();
    return Promise.all(defs.map((d) => this.buildStatus(d.name)));
  }

  async getStatus(name: string): Promise<ServiceStatus> {
    await this.registry.get(name); // validates against allow-list (404 if unknown)
    return this.buildStatus(name);
  }

  private async buildStatus(name: string): Promise<ServiceStatus> {
    const def = await this.registry.get(name);
    const inspect = await this.docker.inspect(name);

    let state: ServiceState = 'missing';
    let health: HealthState = 'none';
    let restartCount: number | null = null;
    let startedAt: string | null = null;
    let image: string | null = null;
    const present = inspect != null;

    if (inspect) {
      state = (inspect.State?.Status as ServiceState) ?? 'unknown';
      health = (inspect.State?.Health?.Status as HealthState) ?? 'none';
      restartCount =
        typeof inspect.RestartCount === 'number' ? inspect.RestartCount : null;
      startedAt = inspect.State?.StartedAt ?? null;
      image = inspect.Config?.Image ?? null;
    }

    let special = null;
    if (def.special_check && state === 'running') {
      try {
        special = await this.specialChecks.run(def.special_check);
      } catch (e) {
        this.logger.warn(`special check ${def.special_check} failed: ${String(e)}`);
      }
    }

    return {
      name,
      order: def.order,
      enabled: def.enabled,
      present,
      state,
      health,
      restartCount,
      startedAt,
      image,
      special,
    };
  }

  async restart(name: string): Promise<ActionResult> {
    const def = await this.registry.get(name);
    this.logger.log(`restart ${name}`);
    const output = await this.docker.recreate(name, def.composeFile);
    return { ok: true, name, action: 'restart', output };
  }

  async up(name: string): Promise<ActionResult> {
    const def = await this.registry.get(name);
    this.logger.log(`up ${name}`);
    const output = await this.docker.composeUp(def.composeFile);
    return { ok: true, name, action: 'up', output };
  }

  async down(name: string): Promise<ActionResult> {
    const def = await this.registry.get(name);
    this.logger.log(`down ${name}`);
    const output = await this.docker.composeDown(def.composeFile);
    return { ok: true, name, action: 'down', output };
  }

  async logs(name: string, tail = 200): Promise<ServiceLogs> {
    const def = await this.registry.get(name);
    let logs = await this.docker.logs(name, tail);
    let source: ServiceLogs['source'] = 'stdout';
    // Some services (e.g. mosquitto) log to a file, not stdout -> docker logs is
    // empty. Fall back to tailing the configured log file via the host mount.
    if (!logs.trim() && def.logFile) {
      logs = await this.tailFile(def.logFile, tail);
      source = 'file';
    }
    if (!logs.trim()) source = 'none';
    return { name, tail, source, logs };
  }

  private tailFile(path: string, n: number): Promise<string> {
    return new Promise((resolve) => {
      execFile(
        'tail',
        ['-n', String(n), path],
        { maxBuffer: 16 * 1024 * 1024 },
        (err, stdout) => {
          if (err) {
            this.logger.warn(`tail ${path} failed: ${String(err)}`);
            return resolve('');
          }
          resolve(stdout ?? '');
        },
      );
    });
  }

  async check(name: string) {
    const def = await this.registry.get(name);
    if (!def.special_check) {
      return { name, check: null, ok: true, detail: 'no special check' };
    }
    const result = await this.specialChecks.run(def.special_check);
    return { name, ...result };
  }
}
