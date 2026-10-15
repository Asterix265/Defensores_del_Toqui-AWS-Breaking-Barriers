import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Defensores del Toqui — API E-1')
    .setDescription('API del copiloto de registro de observaciones (datos sintéticos).')
    .setVersion('0.0.0')
    .setOpenAPIVersion('3.1.0')
    .addBearerAuth()
    .build();
  // OpenAPI 3.1: zod expresa los nullable como `type: [..., 'null']`.
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config), { version: '3.1' });
}
