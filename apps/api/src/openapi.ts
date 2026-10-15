// Exporta openapi.json sin levantar el servidor HTTP ni conectarse a la base de datos.
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi-document';

// Prisma se conecta de forma diferida: esta URL solo satisface la validación de configuración.
process.env['DATABASE_URL'] ??= 'postgresql://openapi:openapi@localhost:5432/openapi';
process.env['AUTH_MODE'] = 'local';

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  const output = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI exportado en ${output}`);
}

void exportOpenApi();
