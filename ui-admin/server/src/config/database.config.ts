import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { getConfig } from './app.config';
import { UserEntity } from '../modules/users/user.entity';

// Load env for the standalone CLI/scripts (Nest loads its own via ConfigModule).
config({ path: '.env.local' });
config();

const appConfig = getConfig();

const base = {
  type: 'postgres' as const,
  host: appConfig.databaseHost,
  port: +appConfig.databasePort,
  username: appConfig.databaseUser,
  password: appConfig.databasePassword,
  database: appConfig.databaseName,
};

// For NestJS (TypeOrmModule.forRootAsync)
export const getTypeOrmConfig = (): TypeOrmModuleOptions => ({
  ...base,
  autoLoadEntities: true,
  synchronize: true,
  retryAttempts: 10,
  retryDelay: 3000,
});

// For the CLI / standalone scripts (create-admin, db:reset)
export const getDataSourceOptions = (): DataSourceOptions => ({
  ...base,
  entities: [UserEntity],
  synchronize: true,
});

const AppDataSource = new DataSource(getDataSourceOptions());
export default AppDataSource;
