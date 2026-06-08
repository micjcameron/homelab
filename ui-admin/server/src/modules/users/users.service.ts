import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from './users.repository';
import { UserEntity } from './user.entity';
import { UserRole } from './users.types';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly config: ConfigService,
  ) {}

  // Auto-seed the admin from env on boot, so the deployed container is usable
  // without a manual step. Idempotent: keeps the DB password in sync with .env.
  async onModuleInit() {
    const username = this.config.get<string>('app.adminUsername');
    const password = this.config.get<string>('app.adminPassword');
    if (username && password && password !== 'CHANGE_ME') {
      try {
        await this.upsertAdmin(username, password);
        this.logger.log(`Admin user '${username}' is provisioned`);
      } catch (e: any) {
        this.logger.warn(`Admin seed skipped: ${e?.message}`);
      }
    } else {
      this.logger.warn(
        'ADMIN_USERNAME/ADMIN_PASSWORD not set — no admin seeded. Run `npm run create-admin`.',
      );
    }
  }

  findByUsername(username: string): Promise<UserEntity | null> {
    return this.users.findByUsername(username);
  }

  /** Create the admin, or update its password/role to match. */
  async upsertAdmin(username: string, plainPassword: string): Promise<UserEntity> {
    const hash = await bcrypt.hash(plainPassword, 10);
    const existing = await this.users.findByUsername(username);
    if (existing) {
      existing.password = hash;
      existing.role = UserRole.ADMIN;
      return this.users.save(existing);
    }
    return this.users.save({ username, password: hash, role: UserRole.ADMIN });
  }
}
