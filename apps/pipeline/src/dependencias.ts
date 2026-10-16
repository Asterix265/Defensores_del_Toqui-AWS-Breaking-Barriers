import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { S3Client } from '@aws-sdk/client-s3';
import { TextractClient } from '@aws-sdk/client-textract';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { ApiInternaHttp } from './adaptadores/api-interna.js';
import { AnonimizadorGuardrail } from './adaptadores/guardrail.js';
import { AvisadorSoloLog, ContextoDesdeMensaje } from './adaptadores/nulos.js';
import { LectorImagenTextract } from './adaptadores/textract.js';
import { tokenDesdeSecreto } from './adaptadores/token.js';
import { TranscriptorAws } from './adaptadores/transcribe.js';
import type { PipelineEnv } from './config.js';
import { ClasificadorBedrock } from './ia/bedrock.js';
import { ClasificadorFake, LectorImagenFake } from './ia/fake.js';
import type { Clasificador, Dependencias, LectorImagen } from './puertos.js';
import type { Log } from './registro-log.js';

/**
 * Elige el proveedor de IA según `IA_PROVIDER`: `fake` (palabras clave, con lector de foto
 * simulado) o `bedrock` (Claude con el cliente de Bedrock compartido con el Guardrail). Con
 * `bedrock` no hay lector de foto propio: la configuración exige `LECTOR_FOTO=textract`.
 */
function crearIa(
  env: PipelineEnv,
  bedrock: BedrockRuntimeClient,
): { clasificador: Clasificador; lectorImagen?: LectorImagen } {
  switch (env.IA_PROVIDER) {
    case 'fake':
      return { clasificador: new ClasificadorFake(), lectorImagen: new LectorImagenFake() };
    case 'bedrock':
      return { clasificador: new ClasificadorBedrock(bedrock, env.MODELO_EXTRACCION) };
  }
}

/** Arma las dependencias reales; se crean una vez por contenedor de Lambda. */
export function crearDependencias(env: PipelineEnv, log: Log): Dependencias {
  const region = env.AWS_REGION;
  const s3 = new S3Client({ region });
  // Un solo cliente de Bedrock por contenedor para el Guardrail y para Claude.
  const bedrock = new BedrockRuntimeClient({ region });
  const token = env.PIPELINE_TOKEN_SECRETO
    ? tokenDesdeSecreto(env.PIPELINE_TOKEN_SECRETO, region)
    : async () => env.PIPELINE_TOKEN!;

  const ia = crearIa(env, bedrock);
  const lectorImagen =
    env.LECTOR_FOTO === 'textract'
      ? new LectorImagenTextract(new TextractClient({ region }), env.BUCKET_CAPTURAS)
      : ia.lectorImagen;
  if (!lectorImagen) {
    // La configuración ya lo rechaza; esto cubre un `env` armado sin `loadEnv`.
    throw new Error(
      `LECTOR_FOTO=ia no está disponible con IA_PROVIDER=${env.IA_PROVIDER}: usa LECTOR_FOTO=textract`,
    );
  }

  return {
    transcriptor: new TranscriptorAws(new TranscribeClient({ region }), s3, {
      bucket: env.BUCKET_CAPTURAS,
      idioma: env.TRANSCRIBE_IDIOMA,
    }),
    anonimizador: new AnonimizadorGuardrail(bedrock, {
      id: env.GUARDRAIL_ID,
      version: env.GUARDRAIL_VERSION,
    }),
    contexto: new ContextoDesdeMensaje(),
    clasificador: ia.clasificador,
    lectorImagen,
    api: new ApiInternaHttp({ url: env.API_URL, token }),
    avisador: new AvisadorSoloLog(log),
  };
}
