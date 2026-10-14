import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { buildOpenApiDocument } from './openapi-document';

// En desarrollo carga apps/api/.env si existe; en contenedores la configuración llega por entorno.
if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
  await app.listen(env.PORT);
}

void bootstrap();
