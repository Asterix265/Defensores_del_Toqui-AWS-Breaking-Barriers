// Prueba de humo del ambiente de producción: CloudFront → web y API → Aurora, aislamiento del ALB
// y el flujo completo de captura (texto, audio y foto) por el pipeline con IA.
import { readFileSync } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  AdminInitiateAuthCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  REGION,
  USUARIOS_PRUEBA,
  contrasenaPrueba,
  leerSalidasStack,
  prepararCredenciales,
} from './comun.js';

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

// --- Flujo completo como educadora: captura → S3 → EventBridge → Step Functions → Lambdas
// (Transcribe, Guardrail, Claude) → endpoint interno → borrador. Las capturas se descartan al final.
const usuario = USUARIOS_PRUEBA[0];
let idToken = '';
let idNino = '';
const creadas: string[] = [];

async function api(ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${web}/api${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const cuerpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok)
    throw new Error(
      `${init.method ?? 'GET'} ${ruta} respondió ${r.status}: ${JSON.stringify(cuerpo)}`,
    );
  return cuerpo;
}

interface Detalle {
  id: string;
  estado: string;
  errorDetalle: string | null;
  borrador: {
    textoFuente: string;
    nivelSugerido: number | null;
    evidenciaInsuficiente: boolean;
    proveedor: string;
    manifestaciones: { manifestacion: { id: string }; cita: string }[];
  } | null;
}

async function esperarBorrador(id: string): Promise<Detalle> {
  for (let i = 0; i < 60; i++) {
    const c = (await api(`/capturas/${id}`)) as unknown as Detalle;
    if (c.estado !== 'procesando') return c;
    await esperar(2000);
  }
  throw new Error('la captura siguió procesando 120 s');
}

function resumen(c: Detalle): string {
  if (c.estado !== 'borrador_listo' || !c.borrador) {
    throw new Error(`quedó en ${c.estado}: ${c.errorDetalle ?? 'sin detalle'}`);
  }
  if (c.borrador.proveedor !== 'bedrock') throw new Error(`proveedor ${c.borrador.proveedor}`);
  const b = c.borrador;
  const propuesta = b.evidenciaInsuficiente
    ? 'evidencia insuficiente'
    : `nivel ${b.nivelSugerido}, ${b.manifestaciones.map((m) => m.manifestacion.id).join(' + ')}`;
  return `«${b.textoFuente.slice(0, 90)}» → ${propuesta}`;
}

async function capturarArchivo(tipo: string, contenido: Uint8Array): Promise<Detalle> {
  const formato = tipo.startsWith('audio/') ? 'audio' : 'foto';
  const r = (await api('/capturas', {
    method: 'POST',
    body: JSON.stringify({ idNino, formato, archivo: { tipo, tamano: contenido.byteLength } }),
  })) as { captura: { id: string }; subida: { url: string; cabeceras: Record<string, string> } };
  creadas.push(r.captura.id);
  const put = await fetch(r.subida.url, {
    method: 'PUT',
    headers: r.subida.cabeceras,
    body: contenido,
  });
  if (!put.ok) throw new Error(`la subida a S3 respondió ${put.status}`);
  return esperarBorrador(r.captura.id);
}

await paso('5. Cognito (educadora sintética) y niños del jardín', async () => {
  const cognito = new CognitoIdentityProviderClient({ region: REGION });
  const auth = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: salidas['UserPoolId'],
      ClientId: salidas['UserPoolClientId'],
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: usuario.email, PASSWORD: contrasenaPrueba() },
    }),
  );
  idToken = auth.AuthenticationResult?.IdToken ?? '';
  if (!idToken) throw new Error('Cognito no devolvió un token de id');
  const ninos = (await api('/ninos')) as unknown as { id: string }[];
  if (!Array.isArray(ninos) || ninos.length === 0) {
    throw new Error('el jardín no tiene niños: ¿se cargó el dataset? (pnpm aws:prod:seed)');
  }
  idNino = ninos[0]!.id;
  return `${usuario.email} ve ${ninos.length} niños o niñas de ${usuario.idJardin}`;
});

if (idToken && idNino) {
  await paso('6. Texto → Guardrail → Claude → borrador', async () => {
    const r = (await api('/capturas', {
      method: 'POST',
      body: JSON.stringify({
        idNino,
        formato: 'texto',
        texto:
          'Durante el juego libre apiló cuatro bloques sin que se cayeran y después dijo "agua" al ver el vaso.',
      }),
    })) as { captura: { id: string } };
    creadas.push(r.captura.id);
    return resumen(await esperarBorrador(r.captura.id));
  });

  await paso('7. Audio → S3 → Transcribe → Claude → borrador', async () => {
    const audio = readFileSync(
      fileURLToPath(new URL('./fixtures/nota-sintetica.wav', import.meta.url)),
    );
    return resumen(await capturarArchivo('audio/wav', audio));
  });

  await paso('8. Foto → S3 → Claude multimodal → borrador', async () => {
    return resumen(await capturarArchivo('image/png', pngBloques()));
  });

  // No dejar notas de prueba en la sala de la demo.
  for (const id of creadas) {
    await api(`/capturas/${id}/descarte`, { method: 'POST' }).catch(() => undefined);
  }
}

/** PNG sintético (bloques apilados de colores) generado en memoria: sin personas reales. */
function pngBloques(): Uint8Array {
  const ancho = 240;
  const alto = 240;
  const colores = [
    [220, 60, 60],
    [60, 140, 220],
    [240, 190, 40],
    [70, 170, 90],
  ];
  const filas: number[] = [];
  for (let y = 0; y < alto; y++) {
    filas.push(0);
    for (let x = 0; x < ancho; x++) {
      const bloque = Math.floor((alto - 1 - y) / 50);
      const dentro = y >= 40 && x >= 80 && x < 160 && bloque < colores.length;
      const [r, g, b] = dentro ? colores[bloque]! : [245, 245, 240];
      filas.push(r!, g!, b!);
    }
  }
  const crc = (datos: Buffer) => {
    let c = ~0;
    for (const byte of datos) {
      c ^= byte;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const bloqueChunk = (tipo: string, datos: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
    const suma = Buffer.alloc(4);
    suma.writeUInt32BE(crc(cuerpo));
    return Buffer.concat([largo, cuerpo, suma]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloqueChunk('IHDR', cabecera),
    bloqueChunk('IDAT', deflateSync(Buffer.from(filas))),
    bloqueChunk('IEND', Buffer.alloc(0)),
  ]);
}

console.log(
  fallidos === 0
    ? '\nTodo conectado: el ambiente de producción está listo.'
    : `\n${fallidos} paso(s) con problemas.`,
);
process.exitCode = fallidos === 0 ? 0 : 1;
