// Carga el dataset E1 por núcleos en Aurora de producción (migrar-dataset-nucleos, D4):
// sube los CSV a `dataset/<huella>/` del bucket de capturas y lanza una tarea Fargate única con
// la definición de la API y `--cargar-dataset`. Aurora sigue cerrada: la carga corre en la VPC.
//
//   pnpm aws:prod:seed --dataset <carpeta datos_publicos> [--dry-run]
//
// Avisar al equipo antes de ejecutarlo. Si la base ya tiene jardines, la tarea no cambia nada.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  DescribeTasksCommand,
  ECSClient,
  RunTaskCommand,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PREFIJO_DATASET } from '../lib/app-stack.js';
import { REGION, leerSalidasStack, prepararCredenciales } from './comun.js';

/** Mismos archivos que `ARCHIVOS` de `apps/api/src/seed/dataset.ts`. */
export const ARCHIVOS_DATASET = [
  'niveles_educativos.csv',
  'nucleos.csv',
  'niveles_trayectoria.csv',
  'versiones_rubrica.csv',
  'jardines.csv',
  'educadoras.csv',
  'salas.csv',
  'personal_salas.csv',
  'ninos.csv',
  'ruta_niveles.csv',
  'manifestaciones.csv',
  'observaciones.csv',
  'observacion_manifestaciones.csv',
  'valoraciones.csv',
  'valoracion_evidencias.csv',
] as const;

const CLUSTER = 'toqui-prod';
const SERVICIO = 'toqui-api';
const GRUPO_LOGS = '/toqui/prod/api';
/** La carga tarda segundos; Fargate tarda en descargar la imagen y arrancar. */
const ESPERA_MAXIMA_S = 15 * 60;

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Huella corta del contenido: la misma carpeta da el mismo prefijo en S3. */
export function huellaDataset(dir: string): string {
  const hash = createHash('sha256');
  for (const archivo of ARCHIVOS_DATASET) {
    hash.update(archivo).update(readFileSync(join(dir, archivo)));
  }
  return hash.digest('hex').slice(0, 12);
}

async function main(): Promise<void> {
  prepararCredenciales();
  const ensayo = process.argv.includes('--dry-run');
  const origen = argumento('--dataset') ?? process.env['DATASET_DIR'];
  if (!origen) throw new Error('Indica la carpeta del dataset: --dataset <ruta a datos_publicos>');
  const dir = resolve(origen);
  const faltantes = ARCHIVOS_DATASET.filter((a) => !existsSync(join(dir, a)));
  if (faltantes.length) throw new Error(`${dir} no contiene: ${faltantes.join(', ')}`);
  const bytes = ARCHIVOS_DATASET.reduce((t, a) => t + statSync(join(dir, a)).size, 0);

  const salidas = await leerSalidasStack('ToquiApp');
  const bucket = salidas['BucketCapturas'];
  if (!bucket) throw new Error('El stack ToquiApp no expone BucketCapturas. ¿Está desplegado?');
  const prefijo = `${PREFIJO_DATASET}${huellaDataset(dir)}/`;
  const uri = `s3://${bucket}/${prefijo}`;

  const ecs = new ECSClient({ region: REGION });
  const { services } = await ecs.send(
    new DescribeServicesCommand({ cluster: CLUSTER, services: [SERVICIO] }),
  );
  const servicio = services?.[0];
  const red = servicio?.networkConfiguration?.awsvpcConfiguration;
  if (!servicio?.taskDefinition || !red) {
    throw new Error(`No se encontró el servicio ${SERVICIO} en ${CLUSTER}. ¿Está desplegado?`);
  }
  const { taskDefinition } = await ecs.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: servicio.taskDefinition }),
  );
  // El contenedor de la API es el que no es `migraciones` (CDK lo llama `web`).
  const contenedor = taskDefinition?.containerDefinitions?.find(
    (c) => c.name !== 'migraciones',
  )?.name;
  if (!contenedor) throw new Error('La definición de tarea no tiene el contenedor de la API');

  console.log(`Dataset: ${dir} (${ARCHIVOS_DATASET.length} CSV, ${(bytes / 1e6).toFixed(1)} MB)`);
  console.log(`Destino: ${uri} (se borra a los 7 días)`);
  console.log(`Tarea:   ${servicio.taskDefinition} · contenedor ${contenedor} · --cargar-dataset`);
  if (ensayo) {
    console.log('Ensayo (--dry-run): no se subió nada ni se lanzó la tarea.');
    return;
  }

  const s3 = new S3Client({ region: REGION });
  for (const archivo of ARCHIVOS_DATASET) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefijo}${archivo}`,
        Body: readFileSync(join(dir, archivo)),
        ContentType: 'text/csv; charset=utf-8',
      }),
    );
  }
  console.log(`✅ ${ARCHIVOS_DATASET.length} CSV subidos.`);

  const { tasks, failures } = await ecs.send(
    new RunTaskCommand({
      cluster: CLUSTER,
      taskDefinition: servicio.taskDefinition,
      launchType: 'FARGATE',
      count: 1,
      startedBy: 'aws-prod-seed',
      networkConfiguration: { awsvpcConfiguration: red },
      overrides: {
        containerOverrides: [
          {
            name: contenedor,
            command: ['node', 'docker-entrypoint.mjs', '--cargar-dataset'],
            environment: [{ name: 'DATASET_S3_URI', value: uri }],
          },
        ],
      },
    }),
  );
  const arn = tasks?.[0]?.taskArn;
  if (!arn) throw new Error(`No se pudo lanzar la tarea: ${JSON.stringify(failures)}`);
  const idTarea = arn.split('/').at(-1);
  console.log(`⏳ Tarea ${idTarea} lanzada; esperando a que termine (migraciones y carga)…`);

  await waitUntilTasksStopped(
    { client: ecs, maxWaitTime: ESPERA_MAXIMA_S },
    { cluster: CLUSTER, tasks: [arn] },
  );
  const { tasks: final } = await ecs.send(
    new DescribeTasksCommand({ cluster: CLUSTER, tasks: [arn] }),
  );
  const resultado = final?.[0]?.containers?.find((c) => c.name === contenedor);
  const logs = `${GRUPO_LOGS}, flujo api/${contenedor}/${idTarea}`;
  if (resultado?.exitCode !== 0) {
    throw new Error(
      `La carga terminó con código ${resultado?.exitCode ?? '?'} (${resultado?.reason ?? final?.[0]?.stoppedReason ?? 'sin motivo'}). Log: ${logs}`,
    );
  }
  console.log(`✅ Carga terminada. Conteos y detalle en el log: ${logs}`);
}

main().catch((error: unknown) => {
  console.error(`❌ ${(error as Error).message}`);
  process.exitCode = 1;
});
