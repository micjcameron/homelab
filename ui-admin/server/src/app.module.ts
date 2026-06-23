import { Module } from '@nestjs/common';
import { join } from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import appConfig from './config/app.config';
import { getTypeOrmConfig } from './config/database.config';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DockerModule } from './modules/docker/docker.module';
import { ServicesModule } from './modules/services/services.module';
import { SystemModule } from './modules/system/system.module';
import { HealthModule } from './modules/health/health.module';
import { NetworkModule } from './modules/network/network.module';
import { ContainersModule } from './modules/containers/containers.module';
import { ProxiesModule } from './modules/proxies/proxies.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env', `.env.${process.env.NODE_ENV}`, '.env.local'],
    }),

    // Serve the built React SPA (copied to /app/public in the image). The API
    // lives under /api so it's excluded from the static/SPA-fallback handler.
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/{*splat}'],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getTypeOrmConfig,
    }),

    // Global baseline rate limit (generous for the authed UI which polls status).
    // Strict per-endpoint @Throttle() limits live on the public routes.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', limit: 120, ttl: 60_000 }],
    }),

    AuthModule,
    UsersModule,
    DockerModule,
    ServicesModule,
    SystemModule,
    HealthModule,
    NetworkModule,
    ContainersModule,
    ProxiesModule,
    SettingsModule,
    TelegramModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
