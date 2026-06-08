import 'reflect-metadata';
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import * as bcrypt from 'bcrypt';
import AppDataSource from '../src/config/database.config';
import { UserEntity } from '../src/modules/users/user.entity';
import { UserRole } from '../src/modules/users/users.types';

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD in your .env first.');
    process.exit(1);
  }

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(UserEntity);
  const hash = await bcrypt.hash(password, 10);

  let user = await repo.findOneBy({ username });
  if (user) {
    user.password = hash;
    user.role = UserRole.ADMIN;
    await repo.save(user);
    console.log(`Updated admin user '${username}'.`);
  } else {
    user = repo.create({ username, password: hash, role: UserRole.ADMIN });
    await repo.save(user);
    console.log(`Created admin user '${username}'.`);
  }

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
