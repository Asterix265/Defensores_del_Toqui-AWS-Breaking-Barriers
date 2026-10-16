import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { S3Client } from '@aws-sdk/client-s3';
import { TextractClient } from '@aws-sdk/client-textract';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { ApiInternaHttp } from './adaptadores/api-interna.js';
import { AnonimizadorGuardrail } from './adaptadores/guardrail.js';
import { AvisadorSoloLog, ContextoVacio } from './adaptadores/nulos.js';
import { LectorImagenTextract } from './adaptadores/textract.js';
import { tokenDesdeSecreto } from './adaptadores/token.js';
import { TranscriptorAws } from './adaptadores/transcribe.js';
import type { PipelineEnv } from './config.js';
import { ClasificadorFake, LectorImagenFake } from './ia/fake.js';
import type { Clasificador, Dependencias, LectorImagen } from './puertos.js';
import type { Log } from './registro-log.js';

/**
 * Elige el proveedor de IA. Para integrar Claude en Bedrock: agregar `bedrock` a
 * `IA_PROVIDER` en `config.ts` e implementar `Clasificador` y `LectorImagen` en `ia/`.
 */
function crearIa(env: PipelineEnv): { clasificador: Clasificador; lectorImagen: LectorImagen } {
  switch (env.IA_PROVIDER) {
    case 'fake':
      return { clasificador: new ClasificadorFake(), lectorImagen: new LectorImagenFake() };
  }
}

/** Arma las dependencias reales; se crean una vez por contenedor de Lambda. */
export function crearDependencias(env: PipelineEnv, log: Log): Dependencias {
  const region = env.AWS_REGION;
  const s3 = new S3Client({ region });
  const token = env.PIPELINE_TOKEN_SECRETO
    ? tokenDesdeSecreto(env.PIPELINE_TOKEN_SECRETO, region)
    : async () => env.PIPELINE_TOKEN!;

  const ia = crearIa(env);
  const lectorImagen =
    env.LECTOR_FOTO === 'textract'
      ? new LectorImagenTextract(new TextractClient({ region }), env.BUCKET_CAPTURAS)
      : ia.lectorImagen;

  return {
    transcriptor: new TranscriptorAws(new TranscribeClient({ region }), s3, {
      bucket: env.BUCKET_CAPTURAS,
      idioma: env.TRANSCRIBE_IDIOMA,
    }),
    anonimizador: new AnonimizadorGuardrail(new BedrockRuntimeClient({ region }), {
      id: env.GUARDRAIL_ID,
      version: env.GUARDRAIL_VERSION,
    }),
    contexto: new ContextoVacio(),
    clasificador: ia.clasificador,
    lectorImagen,
    api: new ApiInternaHttp({ url: env.API_URL, token }),
    avisador: new AvisadorSoloLog(log),
  };
}
