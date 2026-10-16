import type { MensajeCaptura } from '@toqui/shared';
import { ErrorPermanente } from './errores.js';
import type { Dependencias } from './puertos.js';

export interface TextoNormalizado {
  texto: string;
  /** Cómo se obtuvo, para logs y métricas. */
  via: 'escrito' | 'transcribe' | 'lector_imagen';
  /** Proveedor que leyó la foto (`textract`, `fake`…). */
  lector?: string;
}

/**
 * Decide cómo convertir la captura en texto según su formato:
 * - texto: se usa tal cual;
 * - audio: Amazon Transcribe;
 * - foto: el lector configurado en `LECTOR_FOTO` (Amazon Textract por defecto).
 */
export async function normalizar(
  mensaje: MensajeCaptura,
  deps: Pick<Dependencias, 'transcriptor' | 'lectorImagen'>,
): Promise<TextoNormalizado> {
  switch (mensaje.formato) {
    case 'texto':
      return { texto: mensaje.texto.trim(), via: 'escrito' };

    case 'audio': {
      const texto = await deps.transcriptor.transcribir({
        idCaptura: mensaje.idCaptura,
        clave: mensaje.archivoClave,
        tipo: mensaje.archivoTipo,
      });
      if (!texto.trim()) throw new ErrorPermanente('No se reconoció voz en el audio');
      return { texto: texto.trim(), via: 'transcribe' };
    }

    case 'foto': {
      const texto = await deps.lectorImagen.leer({
        idCaptura: mensaje.idCaptura,
        clave: mensaje.archivoClave,
        tipo: mensaje.archivoTipo,
      });
      if (!texto.trim()) throw new ErrorPermanente('No se pudo leer texto en la foto');
      return { texto: texto.trim(), via: 'lector_imagen', lector: deps.lectorImagen.proveedor };
    }
  }
}
