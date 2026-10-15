// Carga el dataset E-1 en Aurora: sube los CSV al bucket de capturas (prefijo `dataset/`, fuera
// del pipeline) y ejecuta una tarea puntual de ECS con la imagen de la API y TAREA=seed.
// Aurora está en subredes aisladas: no se puede cargar desde una máquina del equipo.
// Uso: DATASET_DIR=<carpeta con los CSV> pnpm aws:prod:seed
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { DescribeTasksCommand, ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { REGION, leerSalidasStack, prepararCredenciales } from './comun.js';

const ARCHIVOS = [
  'jardines.csv',
  'educadoras.csv',
  'ninos.csv',
  'ruta_niveles.csv',
  'manifestaciones.csv',
  'observaciones.csv',
  'observacion_manifestaciones.csv',
];
const PREFIJO = 'dataset';

prepararCredenciales();
const origen = process.env['DATASET_DIR'];
if (!origen) throw new Error('Define DATASET_DIR con la carpeta de los CSV del dataset E-1.');
const dir = resolve(origen);
const salidas = await leerSalidasStack('ToquiApp');
const bucket = salidas['BucketCapturas']!;
const s3 = new S3Client({ region: REGION });

console.log(`Subiendo ${ARCHIVOS.length} CSV a s3://${bucket}/${PREFIJO}/ …`);
for (const archivo of ARCHIVOS) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${PREFIJO}/${archivo}`,
      Body: readFileSync(join(dir, archivo)),
      ContentType: 'text/csv',
    }),
  );
}

try {
  const ecs = new ECSClient({ region: REGION });
  const contenedor = salidas['ApiContainerName']!;
  const { tasks, failures } = await ecs.send(
    new RunTaskCommand({
      cluster: salidas['ClusterName'],
      taskDefinition: salidas['ApiTaskDefinitionArn'],
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: salidas['ApiSubnets']!.split(','),
          securityGroups: [salidas['ApiSecurityGroup']!],
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: contenedor,
            environment: [
              { name: 'TAREA', value: 'seed' },
              { name: 'DATASET_DIR', value: `s3://${bucket}/${PREFIJO}` },
            ],
          },
        ],
      },
    }),
  );
  const tarea = tasks?.[0]?.taskArn;
  if (!tarea) throw new Error(`No se pudo iniciar la tarea: ${JSON.stringify(failures)}`);
  console.log(`Tarea iniciada: ${tarea.split('/').pop()}. Esperando (suele tardar 1-3 min) …`);

  let salida: number | undefined;
  for (let i = 0; i < 60; i++) {
    await esperar(5000);
    const { tasks: [t] = [] } = await ecs.send(
      new DescribeTasksCommand({ cluster: salidas['ClusterName'], tasks: [tarea] }),
    );
    if (t?.lastStatus === 'STOPPED') {
      salida = t.containers?.find((c) => c.name === contenedor)?.exitCode;
      if (salida === undefined) console.log(`Detenida: ${t.stoppedReason}`);
      break;
    }
  }

  const logs = new CloudWatchLogsClient({ region: REGION });
  const { events } = await logs
    .send(
      new GetLogEventsCommand({
        logGroupName: '/toqui/prod/api',
        logStreamName: `api/${contenedor}/${tarea.split('/').pop()}`,
        startFromHead: true,
      }),
    )
    .catch(() => ({ events: [] }));
  for (const e of events ?? []) console.log(`  │ ${e.message}`);

  if (salida !== 0) throw new Error(`La carga terminó con código ${salida ?? 'desconocido'}.`);
  console.log('Dataset cargado en Aurora.');
} finally {
  for (const archivo of ARCHIVOS) {
    await s3
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: `${PREFIJO}/${archivo}` }))
      .catch(() => undefined);
  }
}
