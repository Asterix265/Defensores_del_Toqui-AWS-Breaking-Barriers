// Prueba de humo del ambiente de producción: CloudFront → web y API → Aurora, aislamiento del ALB
// y pipeline S3 → EventBridge → Step Functions → Lambda.
import { setTimeout as esperar } from 'node:timers/promises';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DescribeExecutionCommand, ListExecutionsCommand, SFNClient } from '@aws-sdk/client-sfn';
import { REGION, leerSalidasStack, prepararCredenciales } from './comun.js';

let fallidos = 0;
async function paso(nombre: string, fn: () => Promise<string>): Promise<void> {
  const inicio = Date.now();
  try {
    const detalle = await fn();
    console.log(`✅ ${nombre} (${Date.now() - inicio} ms): ${detalle}`);
  } catch (error) {
    fallidos++;
    const detalle = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.log(`❌ ${nombre}: ${detalle}`);
  }
}

prepararCredenciales();
const salidas = await leerSalidasStack('ToquiApp');
const web = salidas['WebUrl'];
if (!web) throw new Error('El stack ToquiApp no expone WebUrl. ¿Está desplegado?');

await paso('1. Web por CloudFront (HTTPS)', async () => {
  const r = await fetch(`${web}/`);
  const html = await r.text();
  if (!r.ok || !html.includes('<div id="root">')) throw new Error(`respondió ${r.status}`);
  return `${web} sirve la PWA`;
});

await paso('2. Rutas de la SPA', async () => {
  const r = await fetch(`${web}/ninos/NINO-00002`);
  const html = await r.text();
  if (!r.ok || !html.includes('<div id="root">')) throw new Error(`respondió ${r.status}`);
  return 'una ruta de la app devuelve index.html';
});

await paso('3. API → Aurora (/api/health)', async () => {
  const r = await fetch(`${web}/api/health`);
  const cuerpo = (await r.json()) as { status?: string; dependencies?: { database?: string } };
  if (cuerpo.status !== 'ok' || cuerpo.dependencies?.database !== 'up') {
    throw new Error(`respondió ${r.status}: ${JSON.stringify(cuerpo)}`);
  }
  return 'API en Fargate conectada a Aurora (migraciones aplicadas)';
});

await paso('4. ALB cerrado fuera de CloudFront', async () => {
  try {
    await fetch(`http://${salidas['AlbDns']}/health`, { signal: AbortSignal.timeout(5000) });
  } catch {
    return 'acceso directo al ALB rechazado';
  }
  throw new Error('el ALB respondió sin pasar por CloudFront');
});

await paso('5. Pipeline (S3 → EventBridge → Step Functions → Lambda)', async () => {
  const s3 = new S3Client({ region: REGION });
  const sfn = new SFNClient({ region: REGION });
  const clave = `capturas/smoke-${Date.now()}.txt`;
  const desde = new Date(Date.now() - 5000);
  await s3.send(
    new PutObjectCommand({
      Bucket: salidas['BucketCapturas'],
      Key: clave,
      Body: 'Captura sintética de prueba',
      ContentType: 'text/plain',
    }),
  );
  try {
    for (let intento = 0; intento < 30; intento++) {
      await esperar(2000);
      const { executions } = await sfn.send(
        new ListExecutionsCommand({ stateMachineArn: salidas['StateMachineArn'], maxResults: 10 }),
      );
      for (const ejecucion of executions ?? []) {
        if (!ejecucion.startDate || ejecucion.startDate < desde) continue;
        const detalle = await sfn.send(
          new DescribeExecutionCommand({ executionArn: ejecucion.executionArn }),
        );
        if (!detalle.input?.includes(clave)) continue;
        if (detalle.status === 'RUNNING') break;
        if (detalle.status !== 'SUCCEEDED') throw new Error(`ejecución ${detalle.status}`);
        return `ejecución ${ejecucion.name} correcta → ${detalle.output}`;
      }
    }
    throw new Error('no apareció una ejecución en 60 s');
  } finally {
    await s3
      .send(new DeleteObjectCommand({ Bucket: salidas['BucketCapturas'], Key: clave }))
      .catch(() => undefined);
  }
});

console.log(
  fallidos === 0
    ? '\nTodo conectado: el ambiente de producción está listo.'
    : `\n${fallidos} paso(s) con problemas.`,
);
process.exitCode = fallidos === 0 ? 0 : 1;
