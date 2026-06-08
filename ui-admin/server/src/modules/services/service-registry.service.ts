import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { ServiceDefinition } from './services.types';
import { UnknownServiceError } from '../../shared/exceptions/errors';

/**
 * Loads the service registry from home-automation/services.json (read fresh
 * each call — tiny file — so it always matches manage.sh / lifeline). Also the
 * allow-list: every control operation validates the name through here.
 */
@Injectable()
export class ServiceRegistryService {
  private readonly logger = new Logger(ServiceRegistryService.name);
  private readonly servicesJson: string;
  private readonly stacksDir: string;
  private readonly hostHomeMount: string;

  constructor(private readonly config: ConfigService) {
    this.servicesJson = this.config.get<string>('app.servicesJson')!;
    this.stacksDir = this.config.get<string>('app.stacksDir')!;
    this.hostHomeMount = this.config.get<string>('app.hostHomeMount', '/host-home');
  }

  async list(): Promise<ServiceDefinition[]> {
    let raw: string;
    try {
      raw = await readFile(this.servicesJson, 'utf8');
    } catch (e) {
      this.logger.error(`Cannot read ${this.servicesJson}: ${String(e)}`);
      return [];
    }
    const parsed = JSON.parse(raw);
    const services = Array.isArray(parsed?.services) ? parsed.services : [];
    return services
      .map((s: any): ServiceDefinition => {
        const composeFile = join(this.stacksDir, s.name, 'docker-compose.yml');
        // `log_file` in services.json is relative to the Pi's home dir; resolve
        // it to the container's host-home mount. Absolute paths pass through.
        const logFile = s.log_file
          ? s.log_file.startsWith('/')
            ? s.log_file
            : join(this.hostHomeMount, s.log_file)
          : undefined;
        return {
          name: s.name,
          enabled: Boolean(s.enabled),
          order: typeof s.order === 'number' ? s.order : 999,
          special_check: s.special_check,
          composeFile,
          composeFileExists: existsSync(composeFile),
          logFile,
        };
      })
      .sort((a: ServiceDefinition, b: ServiceDefinition) => a.order - b.order);
  }

  async get(name: string): Promise<ServiceDefinition> {
    const def = (await this.list()).find((s) => s.name === name);
    if (!def) throw new UnknownServiceError(name);
    return def;
  }

  async has(name: string): Promise<boolean> {
    return (await this.list()).some((s) => s.name === name);
  }
}
