import 'reflect-metadata';
import { existsSync } from 'node:fs';

// Load apps/api/.env in development (production sets real environment variables).
if (existsSync('.env')) process.loadEnvFile('.env');

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfig } from './config';

async function bootstrap() {
  const config = loadConfig();
  // rawBody is needed to verify Razorpay webhook signatures.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  app.enableCors({ origin: config.webUrl, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  // Behind a proxy/load balancer in production, so rate limiting sees real client IPs.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.listen(config.port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${config.port}`);
}

bootstrap();
