// Prueba de humo de los servicios AWS de desarrollo: STS → S3 → Transcribe → Bedrock → Cognito.
// Uso: TOQUI_DEV_PASSWORD=... pnpm aws:smoke   (requiere el stack ToquiDev y `pnpm aws:users`)
import { readFileSync } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  ApplyGuardrailCommand,
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import {
  DeleteTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
} from '@aws-sdk/client-transcribe';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  MODELOS,
  REGION,
  USUARIOS_PRUEBA,
  contrasenaPrueba,
  leerSalidas,
  prepararCredenciales,
} from './comun.js';

type Resultado = { paso: string; ok: boolean; detalle: string; ms: number };
const resultados: Resultado[] = [];

async function paso(nombre: string, fn: () => Promise<string>): Promise<boolean> {
  const inicio = Date.now();
  try {
    const detalle = await fn();
    resultados.push({ paso: nombre, ok: true, detalle, ms: Date.now() - inicio });
    console.log(`✅ ${nombre} (${Date.now() - inicio} ms): ${detalle}`);
    return true;
  } catch (error) {
    const detalle = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    resultados.push({ paso: nombre, ok: false, detalle, ms: Date.now() - inicio });
    console.log(`❌ ${nombre} (${Date.now() - inicio} ms): ${detalle}`);
    return false;
  }
}

function omitir(nombre: string, motivo: string): void {
  resultados.push({ paso: nombre, ok: false, detalle: `omitido: ${motivo}`, ms: 0 });
  console.log(`⏭️  ${nombre}: omitido (${motivo})`);
}

prepararCredenciales();
const salidas = await leerSalidas();
const audio = readFileSync(
  fileURLToPath(new URL('./fixtures/nota-sintetica.wav', import.meta.url)),
);
const clave = `smoke/${Date.now()}-nota-sintetica.wav`;
let transcripcion = '';

await paso('1. IAM (identidad)', async () => {
  const id = await new STSClient({ region: REGION }).send(new GetCallerIdentityCommand({}));
  return `${id.Arn?.split(':').at(-1)} con perfil ${process.env['AWS_PROFILE']}`;
});

const s3 = new S3Client({ region: REGION });
const s3Ok = await paso('2. S3 (subida con URL prefirmada)', async () => {
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: salidas.BucketCapturas, Key: clave, ContentType: 'audio/wav' }),
    { expiresIn: 300 },
  );
  const respuesta = await fetch(url, {
    method: 'PUT',
    body: audio,
    headers: { 'Content-Type': 'audio/wav' },
  });
  if (!respuesta.ok) throw new Error(`PUT respondió ${respuesta.status}`);
  const cabecera = await s3.send(
    new HeadObjectCommand({ Bucket: salidas.BucketCapturas, Key: clave }),
  );
  return `${cabecera.ContentLength} bytes en s3://${salidas.BucketCapturas}/${clave}`;
});

const transcribe = new TranscribeClient({ region: REGION });
if (s3Ok) {
  await paso('3. Transcribe (audio sintético, es-US)', async () => {
    const trabajo = `toqui-smoke-${Date.now()}`;
    await transcribe.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: trabajo,
        LanguageCode: 'es-US',
        MediaFormat: 'wav',
        Media: { MediaFileUri: `s3://${salidas.BucketCapturas}/${clave}` },
      }),
    );
    try {
      for (let intento = 0; intento < 60; intento++) {
        const { TranscriptionJob } = await transcribe.send(
          new GetTranscriptionJobCommand({ TranscriptionJobName: trabajo }),
        );
        const estado = TranscriptionJob?.TranscriptionJobStatus;
        if (estado === 'FAILED') throw new Error(TranscriptionJob?.FailureReason ?? 'falló');
        if (estado === 'COMPLETED') {
          const uri = TranscriptionJob?.Transcript?.TranscriptFileUri;
          if (!uri) throw new Error('sin URI de transcripción');
          const json = (await (await fetch(uri)).json()) as {
            results: { transcripts: { transcript: string }[] };
          };
          transcripcion = json.results.transcripts[0]?.transcript ?? '';
          return `«${transcripcion}»`;
        }
        await esperar(3000);
      }
      throw new Error('la transcripción no terminó en 3 minutos');
    } finally {
      await transcribe
        .send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: trabajo }))
        .catch(() => undefined);
    }
  });
  await s3
    .send(new DeleteObjectCommand({ Bucket: salidas.BucketCapturas, Key: clave }))
    .catch(() => undefined);
} else {
  omitir('3. Transcribe (audio sintético, es-US)', 'falló la subida a S3');
}

const bedrock = new BedrockRuntimeClient({ region: REGION });
await paso('4. Bedrock (Claude + Guardrail)', async () => {
  const texto =
    transcripcion ||
    'Durante el juego libre, la niña apiló tres cubos y luego los derribó riéndose.';
  const respuesta = await bedrock.send(
    new ConverseCommand({
      modelId: MODELOS.extraccion,
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `Resume en una frase breve la conducta observable en esta nota pedagógica: ${texto}`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 120 },
      guardrailConfig: {
        guardrailIdentifier: salidas.GuardrailId,
        guardrailVersion: salidas.GuardrailVersion,
      },
    }),
  );
  const resumen = respuesta.output?.message?.content?.[0]?.text?.trim() ?? '';
  if (!resumen) throw new Error('el modelo no devolvió texto');

  const prueba = await bedrock.send(
    new ApplyGuardrailCommand({
      guardrailIdentifier: salidas.GuardrailId,
      guardrailVersion: salidas.GuardrailVersion,
      source: 'INPUT',
      content: [{ text: { text: 'Apoderado con RUT 12.345.678-5 llamó al jardín.' } }],
    }),
  );
  const anonimizado = prueba.outputs?.[0]?.text ?? '';
  if (prueba.action !== 'GUARDRAIL_INTERVENED' || anonimizado.includes('12.345.678-5')) {
    throw new Error(`el Guardrail no anonimizó el RUT (acción ${prueba.action ?? 'desconocida'})`);
  }
  return `${MODELOS.extraccion} → «${resumen}» · RUT anonimizado: «${anonimizado}»`;
});

await paso('5. Cognito (login + validación del token)', async () => {
  const usuario = USUARIOS_PRUEBA[0];
  const cognito = new CognitoIdentityProviderClient({ region: REGION });
  const auth = await cognito.send(
    new InitiateAuthCommand({
      ClientId: salidas.UserPoolClientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: usuario.email, PASSWORD: contrasenaPrueba() },
    }),
  );
  const token = auth.AuthenticationResult?.IdToken;
  if (!token) throw new Error(`sin token (desafío: ${auth.ChallengeName ?? 'ninguno'})`);
  const verificador = CognitoJwtVerifier.create({
    userPoolId: salidas.UserPoolId,
    clientId: salidas.UserPoolClientId,
    tokenUse: 'id',
  });
  const datos = await verificador.verify(token);
  const grupos = (datos['cognito:groups'] as string[] | undefined) ?? [];
  if (!grupos.includes(usuario.grupo)) throw new Error(`grupos inesperados: ${grupos.join(',')}`);
  if (datos['custom:id_jardin'] !== usuario.idJardin) throw new Error('id_jardin inesperado');
  return `${usuario.email} · grupo ${grupos.join(',')} · ${String(datos['custom:id_jardin'])}`;
});

const fallidos = resultados.filter((r) => !r.ok);
console.log(
  fallidos.length === 0
    ? '\nTodo conectado: el entorno AWS de desarrollo está listo.'
    : `\n${fallidos.length} paso(s) con problemas: ${fallidos.map((r) => r.paso).join(' · ')}`,
);
process.exitCode = fallidos.length === 0 ? 0 : 1;
