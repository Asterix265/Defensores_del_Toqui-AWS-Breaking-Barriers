import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  CapturaEstadoResponseSchema,
  ContextoCapturaSchema,
  type BorradorEntrante,
  type ContextoCaptura,
} from '@toqui/shared';
import type { z } from 'zod';
import type { PipelineEnv } from './config.js';

/** Falla que vale la pena reintentar (red, 5xx, 429): Step Functions la reintenta con espera. */
export class ErrorTransitorio extends Error {
  override name = 'ErrorTransitorio';
}

/** Respuesta 4xx de la API: reintentar no cambia el resultado. */
export class ErrorApi extends Error {
  override name = 'ErrorApi';
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

let tokenEnCache: Promise<string> | undefined;

/** El token se lee una vez por contenedor de Lambda. */
function tokenPipeline(env: PipelineEnv): Promise<string> {
  if (env.PIPELINE_TOKEN) return Promise.resolve(env.PIPELINE_TOKEN);
  tokenEnCache ??= new SecretsManagerClient({ region: env.AWS_REGION })
    .send(new GetSecretValueCommand({ SecretId: env.PIPELINE_TOKEN_SECRET_ARN }))
    .then((r) => {
      if (!r.SecretString) throw new Error('El secreto del pipeline está vacío');
      return r.SecretString;
    })
    .catch((error: unknown) => {
      tokenEnCache = undefined;
      throw error;
    });
  return tokenEnCache;
}

/** Cliente del endpoint interno de la API (D6). Las Lambdas no tocan la base de datos. */
export class ApiInterna {
  constructor(private readonly env: PipelineEnv) {}

  contexto(id: string): Promise<ContextoCaptura> {
    return this.pedir('GET', `/interno/capturas/${id}/contexto`, ContextoCapturaSchema);
  }

  entregarBorrador(id: string, borrador: BorradorEntrante) {
    return this.pedir(
      'POST',
      `/interno/capturas/${id}/borrador`,
      CapturaEstadoResponseSchema,
      borrador,
    );
  }

  informarError(id: string, detalle: string) {
    return this.pedir('POST', `/interno/capturas/${id}/error`, CapturaEstadoResponseSchema, {
      detalle,
    });
  }

  private async pedir<T extends z.ZodType>(
    metodo: 'GET' | 'POST',
    ruta: string,
    esquema: T,
    cuerpo?: unknown,
  ): Promise<z.infer<T>> {
    const token = await tokenPipeline(this.env);
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.env.API_URL.replace(/\/$/, '')}${ruta}`, {
        method: metodo,
        headers: {
          'x-pipeline-token': token,
          ...(cuerpo !== undefined && { 'content-type': 'application/json' }),
        },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new ErrorTransitorio(`${metodo} ${ruta}: ${(error as Error).message}`);
    }
    const texto = await respuesta.text();
    if (respuesta.status >= 500 || respuesta.status === 429) {
      throw new ErrorTransitorio(`${metodo} ${ruta} respondió ${respuesta.status}: ${texto}`);
    }
    if (!respuesta.ok) {
      throw new ErrorApi(
        respuesta.status,
        `${metodo} ${ruta} respondió ${respuesta.status}: ${texto}`,
      );
    }
    return esquema.parse(JSON.parse(texto));
  }
}
