// Entrypoint del contenedor: arma DATABASE_URL desde el secreto de Aurora, aplica migraciones
// y arranca la API. En local basta con definir DATABASE_URL directamente.
// `--migrar` (contenedor `migraciones` en AWS, con el administrador): aplica las migraciones,
// prepara el usuario de la API (APP_DB_USER, sin DDL) y termina sin arrancar la API.
// `--cargar-dataset` (tarea única de `pnpm aws:prod:seed`): carga el dataset desde
// DATASET_S3_URI con el usuario de la API y termina (migrar-dataset-nucleos, D4).
import { spawnSync } from 'node:child_process';

const PRISMA = 'node_modules/.bin/prisma';
const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

const env = process.env;
if (!env.DATABASE_URL && env.DB_HOST) {
  const user = encodeURIComponent(env.DB_USER ?? '');
  const password = encodeURIComponent(env.DB_PASSWORD ?? '');
  const db = env.DB_NAME ?? 'toqui';
  env.DATABASE_URL = `postgresql://${user}:${password}@${env.DB_HOST}:${env.DB_PORT ?? '5432'}/${db}`;
}
// La CLI de Prisma usa su propio driver: con TLS, sslmode=require cifra la conexión.
const urlCli = env.DATABASE_SSL_CA ? `${env.DATABASE_URL}?sslmode=require` : env.DATABASE_URL;

function prisma(args, opciones = {}) {
  const { status } = spawnSync(PRISMA, args, {
    stdio: 'inherit',
    ...opciones,
    env: { ...env, DATABASE_URL: urlCli },
  });
  return status ?? 1;
}

function migrar() {
  const status = prisma(['migrate', 'deploy']);
  if (status !== 0) {
    console.error('Fallaron las migraciones de Prisma; la API no arranca.');
    process.exit(status);
  }
}

/**
 * Crea el usuario de la API si no existe, le fija la contraseña del secreto y le da solo DML.
 * Idempotente; el advisory lock evita choques si arrancan varias tareas a la vez.
 * Sin `NOSUPERUSER`: en Aurora el administrador (`rds_superuser`) no es superusuario y Postgres
 * rechaza cualquier cláusula sobre ese atributo; un rol creado así ya es NOSUPERUSER.
 */
function sqlUsuarioApp(usuario, password, base) {
  const literal = `'${password.replaceAll("'", "''")}'`;
  return `
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('toqui:usuario-app'));
DO $$ BEGIN
  CREATE ROLE ${usuario} LOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER ROLE ${usuario} WITH LOGIN NOCREATEDB NOCREATEROLE PASSWORD ${literal};
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE "${base}" TO ${usuario};
GRANT USAGE ON SCHEMA public TO ${usuario};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${usuario};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${usuario};
REVOKE ALL ON TABLE _prisma_migrations FROM ${usuario};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${usuario};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${usuario};
COMMIT;
`;
}

function prepararUsuarioApp() {
  const usuario = env.APP_DB_USER ?? '';
  const base = env.DB_NAME ?? 'toqui';
  if (!IDENTIFICADOR.test(usuario) || !IDENTIFICADOR.test(base) || !env.APP_DB_PASSWORD) {
    console.error(
      'Faltan APP_DB_USER o APP_DB_PASSWORD válidos para preparar el usuario de la API.',
    );
    process.exit(1);
  }
  // Por stdin: la contraseña no aparece en los argumentos ni en el log.
  const status = prisma(['db', 'execute', '--stdin'], {
    input: sqlUsuarioApp(usuario, env.APP_DB_PASSWORD, base),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (status !== 0) {
    console.error(`No se pudo preparar el usuario ${usuario}; la API no arranca.`);
    process.exit(status);
  }
  console.log(`Usuario ${usuario} listo (solo SELECT, INSERT, UPDATE y DELETE).`);
}

if (process.argv.includes('--migrar')) {
  migrar();
  prepararUsuarioApp();
  process.exit(0);
}

if (process.argv.includes('--cargar-dataset')) {
  // Las migraciones ya las aplicó el contenedor `migraciones` de la misma tarea.
  const { status } = spawnSync('node', ['dist/seed/cargar-dataset.js'], { stdio: 'inherit', env });
  process.exit(status ?? 1);
}

if (env.RUN_MIGRATIONS !== 'false') migrar();

await import('./dist/main.js');
