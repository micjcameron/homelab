import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity } from './device.entity';
import { DeviceStatus } from './network.types';
import { DatabaseOperationError } from '../../shared/exceptions/errors';

@Injectable()
export class DeviceRepository {
  private readonly logger = new Logger(DeviceRepository.name);

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly repo: Repository<DeviceEntity>,
  ) {}

  findByMac(mac: string): Promise<DeviceEntity | null> {
    return this.repo.findOneBy({ mac });
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  findAll(): Promise<DeviceEntity[]> {
    return this.repo.find({ order: { status: 'ASC', lastSeen: 'DESC' } });
  }

  async save(dev: Partial<DeviceEntity>): Promise<DeviceEntity> {
    try {
      return await this.repo.save(this.repo.create(dev));
    } catch (e: any) {
      this.logger.error(`save failed: ${e?.message}`, e?.stack);
      throw new DatabaseOperationError(`save device: ${e?.message}`);
    }
  }

  async setStatus(mac: string, status: DeviceStatus): Promise<DeviceEntity> {
    const dev = await this.findByMac(mac);
    if (!dev) throw new DatabaseOperationError(`device ${mac} not found`);
    dev.status = status;
    dev.approvedAt = status === DeviceStatus.APPROVED ? new Date() : dev.approvedAt;
    return this.repo.save(dev);
  }
}
