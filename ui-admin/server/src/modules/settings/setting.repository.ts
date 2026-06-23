import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingEntity } from './setting.entity';
import { DatabaseOperationError } from '../../shared/exceptions/errors';

@Injectable()
export class SettingRepository {
  private readonly logger = new Logger(SettingRepository.name);

  constructor(
    @InjectRepository(SettingEntity)
    private readonly repo: Repository<SettingEntity>,
  ) {}

  findByKey(key: string): Promise<SettingEntity | null> {
    return this.repo.findOneBy({ key });
  }

  async upsert(key: string, value: string): Promise<void> {
    try {
      await this.repo.upsert({ key, value }, ['key']);
    } catch (e: any) {
      this.logger.error(`upsert '${key}' failed: ${e?.message}`, e?.stack);
      throw new DatabaseOperationError(`save setting: ${e?.message}`);
    }
  }

  async deleteByKey(key: string): Promise<void> {
    await this.repo.delete({ key });
  }
}
