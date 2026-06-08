import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { DatabaseOperationError } from '../../shared/exceptions/errors';

@Injectable()
export class UsersRepository {
  private readonly logger = new Logger(UsersRepository.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findByUsername(username: string): Promise<UserEntity | null> {
    try {
      return await this.repo.findOneBy({ username });
    } catch (e: any) {
      this.logger.error(`findByUsername failed: ${e?.message}`, e?.stack);
      throw new DatabaseOperationError(`findByUsername: ${e?.message}`);
    }
  }

  async count(): Promise<number> {
    return this.repo.count();
  }

  async save(user: Partial<UserEntity>): Promise<UserEntity> {
    try {
      return await this.repo.save(this.repo.create(user));
    } catch (e: any) {
      this.logger.error(`save failed: ${e?.message}`, e?.stack);
      throw new DatabaseOperationError(`save: ${e?.message}`);
    }
  }
}
