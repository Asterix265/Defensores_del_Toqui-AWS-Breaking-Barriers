import type { MensajeCaptura, Procesamiento } from '@toqui/shared';
import type { TextoNormalizado } from './normalizacion.js';
import type { Clasificador } from './puertos.js';

/**
 * Lo que la Lambda declara en el borrador (`procesamiento`, de `persistir-capturas`): la entrada
 * recibida y cómo se hizo cada paso. La web muestra un aviso si algún paso no fue real, así que
 * una clasificación con el proveedor `fake` nunca se presenta como hecha por IA.
 */
export function declararProcesamiento(
  mensaje: MensajeCaptura,
  normalizado: TextoNormalizado,
  clasificador: Pick<Clasificador, 'proveedor' | 'modelo'>,
): Procesamiento {
  const pasos: Procesamiento['pasos'] = [];
  if (normalizado.via === 'transcribe') {
    pasos.push({
      paso: 'transcripcion',
      estado: 'completado',
      detalle: 'Audio transcrito con Amazon Transcribe.',
    });
  }
  if (normalizado.via === 'lector_imagen') {
    pasos.push(
      normalizado.lector === 'fake'
        ? {
            paso: 'lectura_imagen',
            estado: 'simulado',
            detalle: 'Lectura de la foto simulada: se usa un texto de ejemplo.',
          }
        : {
            paso: 'lectura_imagen',
            estado: 'completado',
            detalle:
              normalizado.lector === 'textract'
                ? 'Foto leída con Amazon Textract (reconoce texto impreso; el manuscrito en español puede no leerse).'
                : `Foto leída con ${normalizado.lector ?? 'el lector configurado'}.`,
          },
    );
  }
  pasos.push(
    clasificador.proveedor === 'fake'
      ? {
          paso: 'extraccion',
          estado: 'simulado',
          detalle:
            'IA simulada (proveedor fake): propone una manifestación según palabras clave; todavía no usa Claude en Bedrock.',
        }
      : {
          paso: 'extraccion',
          estado: 'completado',
          detalle: `Clasificada con ${clasificador.modelo ?? clasificador.proveedor}.`,
        },
  );

  const entrada: Procesamiento['entrada'] =
    mensaje.formato === 'texto'
      ? {
          formato: 'texto',
          tipoArchivo: null,
          bytes: Buffer.byteLength(mensaje.texto, 'utf8'),
          claveS3: null,
        }
      : {
          formato: mensaje.formato,
          tipoArchivo: mensaje.archivoTipo,
          bytes: mensaje.archivoBytes ?? 0,
          claveS3: mensaje.archivoClave,
        };
  return {
    simulado: pasos.some((p) => p.estado !== 'completado'),
    entrada,
    pasos,
  };
}
