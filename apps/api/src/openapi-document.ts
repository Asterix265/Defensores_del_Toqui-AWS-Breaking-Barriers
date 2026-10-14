import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Defensores del Toqui — API E-1')
    .setDescription('API del copiloto de registro de observaciones (datos sintéticos).')
    .setVersion('0.0.0')
    .build();
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
