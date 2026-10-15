// Prueba de humo del ambiente de producción: CloudFront → web, API → Aurora y S3, aislamiento del ALB
// y procesamiento SQS → Lambda → API interna.
import { randomUUID } from 'node:crypto';
import { setTimeout as esperar } from 'node:timers/promises';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
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

await paso('3. API → Aurora y S3 (/api/health)', async () => {
  const r = await fetch(`${web}/api/health`);
  const cuerpo = (await r.json()) as {
    status?: string;
    dependencies?: { database?: string; storage?: string };
  };
  if (
    cuerpo.status !== 'ok' ||
    cuerpo.dependencies?.database !== 'up' ||
    cuerpo.dependencies?.storage !== 'up'
  ) {
    throw new Error(`respondió ${r.status}: ${JSON.stringify(cuerpo)}`);
  }
  return 'API en Fargate conectada a Aurora (migraciones aplicadas) y al bucket de capturas con su rol';
});

await paso('4. ALB cerrado fuera de CloudFront', async () => {
  try {
    await fetch(`http://${salidas['AlbDns']}/health`, { signal: AbortSignal.timeout(5000) });
  } catch {
    return 'acceso directo al ALB rechazado';
  }
  throw new Error('el ALB respondió sin pasar por CloudFront');
});

await paso('5. Procesamiento (SQS → Lambda → API interna)', async () => {
  // Trabajo sintético de una captura que no existe: la Lambda obtiene el token, anonimiza,
  // clasifica y entrega; la API lo autoriza y responde 404, y la Lambda descarta el trabajo.
  // Un 401 (token) o un fallo de Bedrock aparecen como reintento en el log.
  const idCaptura = randomUUID();
  const desde = Date.now() - 5000;
  await new SQSClient({ region: REGION }).send(
    new SendMessageCommand({
      QueueUrl: salidas['ColaCapturasUrl'],
      MessageBody: JSON.stringify({
        version: 1,
        idCaptura,
        idUsuario: 'smoke',
        idJardin: 'SMOKE',
        edadMeses: 20,
        nivelEsperado: 4,
        catalogo: [
          { id: 'SMOKE-1', nivel: 4, dominio: 'motor_fino', textoObservable: 'Apila bloques' },
        ],
        formato: 'texto',
        texto: 'Nota sintética de prueba: apiló cuatro bloques sin ayuda.',
      }),
    }),
  );
  const logs = new CloudWatchLogsClient({ region: REGION });
  for (let intento = 0; intento < 30; intento++) {
    await esperar(2000);
    const { events = [] } = await logs.send(
      new FilterLogEventsCommand({
        logGroupName: salidas['GrupoLogsProceso'],
        startTime: desde,
        filterPattern: `"${idCaptura}"`,
      }),
    );
    const lineas = events.map((e) => e.message ?? '');
    if (lineas.some((l) => l.includes('ya no admite borrador') && l.includes('404'))) {
      return 'la Lambda procesó el trabajo y la API interna aceptó su token (404 esperado)';
    }
    const fallo = lineas.find((l) => l.includes('Falló el intento') || l.includes('agotaron'));
    if (fallo) throw new Error(fallo.slice(fallo.indexOf('{')));
  }
  throw new Error('la Lambda no registró el trabajo en 60 s');
});

console.log(
  fallidos === 0
    ? '\nTodo conectado: el ambiente de producción está listo.'
    : `\n${fallidos} paso(s) con problemas.`,
);
process.exitCode = fallidos === 0 ? 0 : 1;
