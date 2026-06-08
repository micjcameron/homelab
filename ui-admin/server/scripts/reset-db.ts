import 'reflect-metadata';
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import AppDataSource from '../src/config/database.config';

// Drops and recreates the schema (synchronize). Re-seeds the admin from env on
// the next app boot (UsersService.onModuleInit) — or run `npm run create-admin`.
async function main() {
  await AppDataSource.initialize();
  console.log('Dropping schema…');
  await AppDataSource.dropDatabase();
  console.log('Recreating schema…');
  await AppDataSource.synchronize();
  await AppDataSource.destroy();
  console.log('Database reset complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
