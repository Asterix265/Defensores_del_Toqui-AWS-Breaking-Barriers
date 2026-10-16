import {
  CapturaEstadoResponseSchema,
  type BorradorEntrante,
  type EstadoCaptura,
} from '@toqui/shared';
import { ErrorCapturaCerrada, ErrorPermanente } from '../errores.js';
import type { ApiInterna } from '../puertos.js';

/** Igual que `CABECERA_PIPELINE` en `apps/api/src/capturas/interno.controller.ts`. */
const CABECERA_PIPELINE = 'x-pipeline-token';

/** El detalle del error tiene un máximo de 500 caracteres (`ErrorPipelineRequestSchema`). */
const LARGO_DETALLE = 500;

export interface OpcionesApi {
  /** Base con el prefijo `/api`, sin barra final. */
  url: string;
  token: () => Promise<string>;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** Cliente de `POST /interno/capturas/:id/{borrador,error}`; ambos son idempotentes. */
export class ApiInternaHttp implements ApiInterna {
  constructor(private readonly opciones: OpcionesApi) {}

  entregarBorrador(idCaptura: string, borrador: BorradorEntrante): Promise<EstadoCaptura> {
    return this.enviar(idCaptura, 'borrador', borrador);
  }

  informarError(idCaptura: string, detalle: string): Promise<EstadoCaptura> {
    return this.enviar(idCaptura, 'error', { detalle: detalle.slice(0, LARGO_DETALLE) });
  }

  private async enviar(
    idCaptura: string,
    accion: 'borrador' | 'error',
    cuerpo: unknown,
  ): Promise<EstadoCaptura> {
    const { url, token, timeoutMs = 10_000, fetch: hacerFetch = fetch } = this.opciones;
    const respuesta = await hacerFetch(
      `${url}/interno/capturas/${encodeURIComponent(idCaptura)}/${accion}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', [CABECERA_PIPELINE]: await token() },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (respuesta.ok) {
      return CapturaEstadoResponseSchema.parse(await respuesta.json()).estado;
    }
    // 404: no existe; 409: ya confirmada o descartada. Reintentar no cambia nada.
    if (respuesta.status === 404 || respuesta.status === 409) {
      throw new ErrorCapturaCerrada(respuesta.status);
    }
    // 400/422: la API rechazó el contenido; un reintento enviaría lo mismo.
    if (respuesta.status === 400 || respuesta.status === 422) {
      throw new ErrorPermanente('La propuesta generada no pasó la validación');
    }
    // 401/403 (token mal configurado), 429 y 5xx: transitorio, que reintente la cola.
    throw new Error(`La API respondió ${respuesta.status} al entregar ${accion}`);
  }
}
