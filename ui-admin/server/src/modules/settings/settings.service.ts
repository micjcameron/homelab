import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingRepository } from './setting.repository';
import { decryptSecret, encryptSecret } from '../../shared/crypto.util';

/**
 * Encrypted key/value store for app settings (e.g. the Cloudflare API token).
 * Values are AES-GCM encrypted at rest; the key derives from JWT_SECRET.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly encKey: string;

  constructor(
    private readonly repo: SettingRepository,
    config: ConfigService,
  ) {
    this.encKey = config.get<string>('app.jwtSecret') || 'changeMeJwtSecret';
  }

  async getSecret(key: string): Promise<string | null> {
    const row = await this.repo.findByKey(key);
    if (!row) return null;
    try {
      return decryptSecret(row.value, this.encKey);
    } catch (e) {
      this.logger.error(`cannot decrypt setting '${key}': ${String(e)}`);
      return null;
    }
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this.repo.upsert(key, encryptSecret(value, this.encKey));
  }

  async clear(key: string): Promise<void> {
    await this.repo.deleteByKey(key);
  }
}
