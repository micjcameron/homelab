import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { winstonLogger } from './logger/winston-logger';
import { setupSwagger } from './utils/swagger.utils';

async function bootstrap() {
  const logger = new Logger('MainApp');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonLogger),
  });

  // Behind the Cloudflare tunnel; trust the proxy so per-IP throttling sees the
  // real client IP (CF-Connecting-IP / X-Forwarded-For).
  app.set('trust proxy', 1);

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: true, credentials: true });

  setupSwagger(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 8090);
  await app.listen(port, '0.0.0.0');
  logger.log(`ui-admin server running on http://0.0.0.0:${port} (api prefix: /api)`);
}

bootstrap();
