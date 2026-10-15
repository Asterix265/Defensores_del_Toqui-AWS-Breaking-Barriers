import { z } from 'zod';
import { ApiInterna, ErrorApi } from '../api.js';
import { loadEnv } from '../config.js';

const EntradaSchema = z.object({
  idCaptura: z.string().min(1),
  error: z.object({ Error: z.string().optional(), Cause: z.string().optional() }).optional(),
});

/** Mensaje para la educadora según el error del estado que falló. */
export function detalleDe(error?: { Error?: string; Cause?: string }): string {
  let mensaje: string | undefined;
  try {
    mensaje = (JSON.parse(error?.Cause ?? '') as { errorMessage?: string }).errorMessage;
  } catch {
    mensaje = error?.Cause;
  }
  switch (error?.Error) {
    case 'FotoNoValida':
      return (mensaje ?? 'No se pudo leer la foto').slice(0, 500);
    case 'TranscripcionFallida':
      return 'No se pudo transcribir el audio; intente grabarlo de nuevo';
    case 'States.Timeout':
      return 'El procesamiento tardó demasiado; intente de nuevo';
    default:
      return 'No se pudo procesar la nota';
  }
}

/** Último recurso: marca la captura en error para que la educadora pueda decidir. */
export async function handler(evento: unknown) {
  const { idCaptura, error } = EntradaSchema.parse(evento);
  console.error(`Pipeline fallido para ${idCaptura}`, JSON.stringify(error));
  try {
    return await new ApiInterna(loadEnv()).informarError(idCaptura, detalleDe(error));
  } catch (e) {
    // Un objeto sin captura (404) no tiene a quién informar.
    if (e instanceof ErrorApi && e.estado === 404) return { id: idCaptura, estado: 'inexistente' };
    throw e;
  }
}
