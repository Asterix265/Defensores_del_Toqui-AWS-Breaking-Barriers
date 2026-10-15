// Carga el dataset E-1 desde DATASET_DIR: `pnpm db:seed` (compila la API y ejecuta este archivo).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { CONTEOS_ESPERADOS, cargarDataset, leerDataset } from './dataset';

if (process.env['NODE_ENV'] !== 'production' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main(): Promise<void> {
  const dir = process.env['DATASET_DIR'] && resolve(process.env['DATASET_DIR']);
  const datos = leerDataset(dir);
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL no está definida');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const resultado = await cargarDataset(prisma, datos);
    if (!resultado.cargado) {
      console.log(`Sin cambios: ${resultado.motivo}.`);
      return;
    }
    console.log(`Dataset cargado desde ${dir}:`);
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
