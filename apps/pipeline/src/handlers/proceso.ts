import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { MensajeCapturaSchema, type EstadoCaptura, type MensajeCaptura } from '@toqui/shared';
import { loadEnv } from '../config.js';
import { crearDependencias } from '../dependencias.js';
import { ErrorCapturaCerrada, ErrorPermanente } from '../errores.js';
import { procesarCaptura } from '../orquestador.js';
import type { Dependencias } from '../puertos.js';
import { describirError, log as logBase, type Log } from '../registro-log.js';

/** Lo que ve la educadora cuando se agotan los reintentos. */
const DETALLE_REINTENTOS = 'No se pudo procesar la nota. Intenta registrarla de nuevo.';

export interface ContextoHandler {
  deps: Dependencias;
  /** `maxReceiveCount` de la cola: en ese intento se informa el error en vez de reintentar. */
  maxIntentos: number;
}

/**
 * Lambda `toqui-prod-proceso`, activada por la cola de capturas (D4). Con `batchSize: 1` y
 * `reportBatchItemFailures`, cada mensaje termina de una de estas formas:
 * - borrador entregado → se borra de la cola;
 * - error permanente → se informa a la API y se borra;
 * - error transitorio → vuelve a la cola, salvo en el último intento, donde se informa el
 *   error para que la captura no quede en `procesando` cuando el mensaje pase a la DLQ.
 */
export function crearHandler(obtenerContexto: () => ContextoHandler, log: Log = logBase) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const { deps, maxIntentos } = obtenerContexto();
    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
    for (const record of event.Records) {
      const terminado = await procesarRegistro(record, deps, maxIntentos, log);
      if (!terminado) batchItemFailures.push({ itemIdentifier: record.messageId });
    }
    return { batchItemFailures };
  };
}

/** `true` si el mensaje se puede borrar de la cola. */
async function procesarRegistro(
  record: SQSRecord,
  deps: Dependencias,
  maxIntentos: number,
  log: Log,
): Promise<boolean> {
  const intento = Number(record.attributes.ApproximateReceiveCount) || 1;
  const lectura = leerMensaje(record.body);
  if (!lectura.ok) {
    log('error', 'Mensaje de la cola inválido', {
      messageId: record.messageId,
      idCaptura: lectura.idCaptura,
      problemas: lectura.problemas,
    });
    // Sin id no hay a quién informar: que llegue a la DLQ para revisarlo.
    if (!lectura.idCaptura) return false;
    return informarError(deps, lectura.idCaptura, null, 'El trabajo llegó incompleto', log);
  }

  const mensaje = lectura.mensaje;
  const base = { idCaptura: mensaje.idCaptura, messageId: record.messageId, intento };
  log('info', 'Procesando captura', { ...base, formato: mensaje.formato });
  try {
    const { estado } = await procesarCaptura(mensaje, deps, log);
    await avisar(deps, mensaje.idUsuario, mensaje.idCaptura, estado, log);
    return true;
  } catch (error) {
    if (error instanceof ErrorCapturaCerrada) {
      log('info', 'La captura ya no admite borrador; se descarta el trabajo', {
        ...base,
        status: error.status,
      });
      return true;
    }
    if (error instanceof ErrorPermanente) {
      log('warn', 'Captura no procesable', { ...base, ...describirError(error) });
      return informarError(deps, mensaje.idCaptura, mensaje.idUsuario, error.detalle, log);
    }
    if (intento < maxIntentos) {
      log('warn', 'Falló el intento; se reintentará', { ...base, ...describirError(error) });
      return false;
    }
    log('error', 'Se agotaron los intentos', { ...base, ...describirError(error) });
    return informarError(deps, mensaje.idCaptura, mensaje.idUsuario, DETALLE_REINTENTOS, log);
  }
}

async function informarError(
  deps: Dependencias,
  idCaptura: string,
  idUsuario: string | null,
  detalle: string,
  log: Log,
): Promise<boolean> {
  try {
    const estado = await deps.api.informarError(idCaptura, detalle);
    if (idUsuario) await avisar(deps, idUsuario, idCaptura, estado, log);
    return true;
  } catch (error) {
    if (error instanceof ErrorCapturaCerrada) return true;
    // Se reintenta; si era el último intento, el mensaje queda en la DLQ.
    log('error', 'No se pudo informar el error a la API', { idCaptura, ...describirError(error) });
    return false;
  }
}

/** El aviso es de mejor esfuerzo: si falla, la web lo ve en la consulta de respaldo. */
async function avisar(
  deps: Dependencias,
  idUsuario: string,
  idCaptura: string,
  estado: EstadoCaptura,
  log: Log,
): Promise<void> {
  if (estado !== 'borrador_listo' && estado !== 'error') return;
  try {
    await deps.avisador.avisar(idUsuario, { idCaptura, estado });
  } catch (error) {
    log('warn', 'No se pudo publicar el aviso', { idCaptura, estado, ...describirError(error) });
  }
}

type Lectura =
  | { ok: true; mensaje: MensajeCaptura }
  | { ok: false; idCaptura: string | null; problemas: string[] };

/** Valida el cuerpo sin registrar su contenido, que puede traer el texto de la nota. */
function leerMensaje(cuerpo: string): Lectura {
  let json: unknown;
  try {
    json = JSON.parse(cuerpo);
  } catch {
    return { ok: false, idCaptura: null, problemas: ['el cuerpo no es JSON'] };
  }
  const parseo = MensajeCapturaSchema.safeParse(json);
  if (parseo.success) return { ok: true, mensaje: parseo.data };
  const id = (json as { idCaptura?: unknown } | null)?.idCaptura;
  return {
    ok: false,
    idCaptura: typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null,
    problemas: parseo.error.issues.map((i) => `${i.path.join('.')}: ${i.code}`),
  };
}

let contexto: ContextoHandler | undefined;

export const handler = crearHandler(() => {
  if (!contexto) {
    const env = loadEnv();
    contexto = { deps: crearDependencias(env, logBase), maxIntentos: env.MAX_INTENTOS };
  }
  return contexto;
});
