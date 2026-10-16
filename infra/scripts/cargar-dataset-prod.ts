// Carga el dataset E1 por núcleos en Aurora de producción (migrar-dataset-nucleos, D4):
// sube los CSV a `dataset/<huella>/` del bucket de capturas y lanza una tarea Fargate única con
// la definición de la API y `--cargar-dataset`. Aurora sigue cerrada: la carga corre en la VPC.
//
//   pnpm aws:prod:seed --dataset <carpeta datos_publicos> [--dry-run]
//
// Avisar al equipo antes de ejecutarlo. Si la base ya tiene jardines, la tarea no cambia nada.
// Se niega a lanzar la tarea si ToquiApp no terminó bien su último despliegue o no tiene este
// cambio: su definición de tarea no conocería `--cargar-dataset` y arrancaría la API.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import {
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  DescribeTasksCommand,
  ECSClient,
  RunTaskCommand,
  StopTaskCommand,
  waitUntilTasksStopped,
} from '@aws-sdk/client-ecs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PREFIJO_DATASET } from '../lib/app-stack.js';
import { REGION, prepararCredenciales } from './comun.js';

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

const STACK = 'ToquiApp';
const CLUSTER = 'toqui-prod';
const SERVICIO = 'toqui-api';
const GRUPO_LOGS = '/toqui/prod/api';
/** La carga tarda segundos; Fargate tarda en descargar la imagen y arrancar. */
const ESPERA_MAXIMA_S = 15 * 60;
/** Último despliegue terminado sin rollback: el servicio corre la definición de tarea del stack. */
const ESTADOS_ESTABLES = new Set(['CREATE_COMPLETE', 'UPDATE_COMPLETE']);

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Por qué no se puede lanzar la carga sobre ToquiApp, o null si se puede. Tras un rollback, con
 * un despliegue en curso o con un despliegue sin este cambio (sin la salida `PrefijoDataset`), el
 * servicio puede correr una definición de tarea que ignora `--cargar-dataset`: arrancaría la API
 * y la tarea no terminaría nunca.
 */
export function impedimentoStack(estado: string, salidas: Record<string, string>): string | null {
  if (!ESTADOS_ESTABLES.has(estado)) {
    return `${STACK} está en ${estado}: su último despliegue no terminó bien y el servicio puede correr una definición de tarea anterior. Revisa el error en CloudFormation y vuelve a desplegar con pnpm aws:prod:deploy`;
  }
  if (salidas['PrefijoDataset'] !== PREFIJO_DATASET) {
    return `${STACK} no tiene desplegado migrar-dataset-nucleos (falta la salida PrefijoDataset): su definición de tarea no conoce --cargar-dataset. Despliega antes con pnpm aws:prod:deploy`;
  }
  if (!salidas['BucketCapturas']) return `${STACK} no expone BucketCapturas`;
  return null;
}

/**
 * Espera a que la tarea termine. Si la espera falla (tiempo agotado, red o credenciales), detiene
 * la tarea para no dejarla corriendo fuera del balanceador.
 */
export async function esperarODetener(
  ecs: Pick<ECSClient, 'send'>,
  arn: string,
  esperar: () => Promise<unknown>,
): Promise<void> {
  try {
    await esperar();
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    try {
      await ecs.send(
        new StopTaskCommand({
          cluster: CLUSTER,
          task: arn,
          reason: 'aws:prod:seed: la espera de la carga falló',
        }),
      );
    } catch (errorAlDetener) {
      // El mensaje ya incluye el motivo de la espera; la causa es el fallo al detener.
      throw new Error(
        `La espera de la tarea falló (${motivo}) y no se pudo detener (${(errorAlDetener as Error).message}). Detenla a mano: aws ecs stop-task --cluster ${CLUSTER} --task ${arn}`,
        { cause: errorAlDetener },
      );
    }
    throw new Error(`La espera de la tarea falló (${motivo}); se pidió detenerla: ${arn}`, {
      cause: error,
    });
  }
}

async function leerStack(): Promise<{ estado: string; salidas: Record<string, string> }> {
  const cfn = new CloudFormationClient({ region: REGION });
  const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: STACK }));
  const stack = Stacks?.[0];
  return {
    estado: stack?.StackStatus ?? 'desconocido',
    salidas: Object.fromEntries(
      (stack?.Outputs ?? []).map((o) => [o.OutputKey ?? '', o.OutputValue ?? '']),
    ),
  };
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

  const { estado, salidas } = await leerStack();
  const impedimento = impedimentoStack(estado, salidas);
  if (impedimento) throw new Error(impedimento);
  const bucket = salidas['BucketCapturas']!;
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

  await esperarODetener(ecs, arn, () =>
    waitUntilTasksStopped(
      { client: ecs, maxWaitTime: ESPERA_MAXIMA_S },
      { cluster: CLUSTER, tasks: [arn] },
    ),
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

// Solo al ejecutarlo (`tsx scripts/cargar-dataset-prod.ts`), no al importarlo en las pruebas.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(`❌ ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
