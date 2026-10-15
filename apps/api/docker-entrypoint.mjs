// Entrypoint del contenedor: arma DATABASE_URL desde el secreto de Aurora, aplica migraciones
// y arranca la API. En local basta con definir DATABASE_URL directamente.
import { spawnSync } from 'node:child_process';

const env = process.env;
if (!env.DATABASE_URL && env.DB_HOST) {
  const user = encodeURIComponent(env.DB_USER ?? '');
  const password = encodeURIComponent(env.DB_PASSWORD ?? '');
  const db = env.DB_NAME ?? 'toqui';
  env.DATABASE_URL = `postgresql://${user}:${password}@${env.DB_HOST}:${env.DB_PORT ?? '5432'}/${db}`;
}

if (env.RUN_MIGRATIONS !== 'false') {
  // La CLI de Prisma usa su propio driver: con TLS, sslmode=require cifra la conexión.
  const url = env.DATABASE_SSL_CA ? `${env.DATABASE_URL}?sslmode=require` : env.DATABASE_URL;
  const { status } = spawnSync('node_modules/.bin/prisma', ['migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...env, DATABASE_URL: url },
  });
  if (status !== 0) {
    console.error('Fallaron las migraciones de Prisma; la API no arranca.');
    process.exit(status ?? 1);
  }
}

await import('./dist/main.js');
