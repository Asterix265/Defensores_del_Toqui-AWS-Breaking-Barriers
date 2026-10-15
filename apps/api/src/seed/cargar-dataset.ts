// Carga el dataset E-1 desde DATASET_DIR: `pnpm db:seed` (compila la API y ejecuta este archivo).
// DATASET_DIR puede ser `s3://<bucket>/<prefijo>`: así se carga Aurora desde una tarea de ECS.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { ARCHIVOS, CONTEOS_ESPERADOS, cargarDataset, leerDataset } from './dataset';

if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

/** Descarga los CSV de `s3://bucket/prefijo` a una carpeta temporal. */
async function descargarDeS3(uri: string): Promise<string> {
  const { hostname: bucket, pathname } = new URL(uri);
  const prefijo = pathname.replace(/^\/|\/$/g, '');
  const s3 = new S3Client({ region: process.env['AWS_REGION'] });
  const dir = mkdtempSync(join(tmpdir(), 'dataset-'));
  for (const archivo of ARCHIVOS) {
    const respuesta = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: prefijo ? `${prefijo}/${archivo}` : archivo }),
    );
    writeFileSync(join(dir, archivo), await respuesta.Body!.transformToString('utf-8'));
  }
  return dir;
}

async function main(): Promise<void> {
  const origen = process.env['DATASET_DIR'];
  const dir = origen?.startsWith('s3://') ? await descargarDeS3(origen) : origen && resolve(origen);
  const datos = leerDataset(dir);
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL no está definida');

  // Igual que PrismaService: en Aurora, TLS verificado con el bundle de CA de RDS.
  const ca = process.env['DATABASE_SSL_CA'];
  const ssl = ca ? { ca: readFileSync(ca, 'utf8') } : undefined;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ssl }) });
  try {
    const resultado = await cargarDataset(prisma, datos);
    if (!resultado.cargado) {
      console.log(`Sin cambios: ${resultado.motivo}.`);
      return;
    }
    console.log(`Dataset cargado desde ${origen}:`);
    for (const [clave, total] of Object.entries(resultado.conteos)) {
      const esperado = CONTEOS_ESPERADOS[clave as keyof typeof CONTEOS_ESPERADOS];
      console.log(`  ${clave}: ${total}${total === esperado ? '' : ` (se esperaban ${esperado})`}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`Carga fallida: ${(error as Error).message}`);
  process.exitCode = 1;
});
