// Carga el dataset E1 por núcleos desde DATASET_DIR: `pnpm db:seed` (compila la API y ejecuta
// este archivo). En AWS lo ejecuta `docker-entrypoint.mjs --cargar-dataset` con DATASET_S3_URI:
// descarga los CSV del bucket a una carpeta temporal y carga desde ahí (migrar-dataset-nucleos, D4).
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, resolve } from 'node:path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { ARCHIVOS, CONTEOS_ESPERADOS, cargarDataset, leerDataset } from './dataset';

if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

/** `s3://bucket/prefijo/` → bucket y prefijo, o null si no es una URI de S3. */
export function partesUriS3(uri: string): { bucket: string; prefijo: string } | null {
  const [, bucket, prefijo = ''] = /^s3:\/\/([^/]+)\/?(.*)$/.exec(uri) ?? [];
  return bucket ? { bucket, prefijo } : null;
}

/** Carpeta con los CSV: DATASET_DIR, o una temporal con lo descargado de DATASET_S3_URI. */
async function carpetaDataset(): Promise<string | undefined> {
  const uri = process.env['DATASET_S3_URI'];
  if (!uri) return process.env['DATASET_DIR'] && resolve(process.env['DATASET_DIR']);
  const partes = partesUriS3(uri);
  if (!partes) throw new Error(`DATASET_S3_URI no es una URI de S3: ${uri}`);
  const dir = mkdtempSync(join(tmpdir(), 'dataset-'));
  const s3 = new S3Client({});
  for (const archivo of ARCHIVOS) {
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: partes.bucket, Key: posix.join(partes.prefijo, archivo) }),
    );
    if (!Body) throw new Error(`${archivo} vacío en ${uri}`);
    writeFileSync(join(dir, archivo), await Body.transformToString('utf-8'));
  }
  console.log(`${ARCHIVOS.length} CSV descargados de ${uri}.`);
  return dir;
}

async function main(): Promise<void> {
  const dir = await carpetaDataset();
  const datos = leerDataset(dir);
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL no está definida');

  // En Aurora, TLS verificado con el bundle de CA de RDS (igual que PrismaService).
  const ca = process.env['DATABASE_SSL_CA'];
  const ssl = ca ? { ca: readFileSync(ca, 'utf8') } : undefined;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ssl }) });
  try {
    const resultado = await cargarDataset(prisma, datos);
    if (!resultado.cargado) {
      console.log(`Sin cambios: ${resultado.motivo}.`);
      return;
    }
    console.log(`Dataset cargado desde ${process.env['DATASET_S3_URI'] ?? dir}:`);
    for (const [clave, total] of Object.entries(resultado.conteos)) {
      const esperado = CONTEOS_ESPERADOS[clave as keyof typeof CONTEOS_ESPERADOS];
      console.log(`  ${clave}: ${total}${total === esperado ? '' : ` (se esperaban ${esperado})`}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(`Carga fallida: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
