// Punto de entrada de la Lambda API (API Gateway HTTP API → serverless-express → Nest).
import 'reflect-metadata';
import serverlessExpress from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import type { Handler } from 'aws-lambda';
import { AppModule } from './app.module';

let servidor: Handler | undefined;

/** Nest se inicia una vez por contenedor y se reutiliza mientras la Lambda siga caliente. */
async function iniciar(): Promise<Handler> {
  const app = await NestFactory.create(AppModule);
  await app.init();
  return serverlessExpress({ app: app.getHttpAdapter().getInstance() });
}

export const handler: Handler = async (event, context, callback) => {
  servidor ??= await iniciar();
  return servidor(event, context, callback);
};
