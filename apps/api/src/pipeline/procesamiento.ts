import type { Procesamiento } from '@toqui/shared';

/** Textos de ejemplo para audio y foto cuando no hay Transcribe ni lectura de imágenes. */
const LECTURAS: Record<'audio' | 'foto', string[]> = {
  audio: [
    'Buscó el autito que tapé con el pañal y dijo ba-ba-ba mirando a su compañero.',
    'Se puso los zapatos sola después de la siesta y me los mostró contenta.',
  ],
  foto: [
    'Apiló 4 bloques de espuma solo y aplaudió cuando no se cayeron.',
    'Gateó hasta el sonajero y lo agitó para que sonara.',
  ],
};

function semilla(texto: string): number {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Texto de ejemplo para audio o foto, elegido de forma determinista por la captura. */
export function lecturaDeEjemplo(formato: 'audio' | 'foto', idCaptura: string): string {
  const opciones = LECTURAS[formato];
  return opciones[semilla(idCaptura) % opciones.length]!;
}

export type Paso = Procesamiento['pasos'][number];

export const PASOS = {
  transcripcionPendiente: {
    paso: 'transcripcion',
    estado: 'no_implementado',
    detalle:
      'Amazon Transcribe aún no está conectado: en vez de la transcripción del audio se usa un texto de ejemplo.',
  },
  lecturaPendiente: {
    paso: 'lectura_imagen',
    estado: 'no_implementado',
    detalle:
      'La lectura de imágenes aún no está conectada: en vez de lo escrito en la foto se usa un texto de ejemplo.',
  },
  lecturaClaude: (modelo: string): Paso => ({
    paso: 'lectura_imagen',
    estado: 'completado',
    detalle: `Claude (${modelo}) en Amazon Bedrock leyó la foto: transcribió lo escrito o, si no había texto, describió la actividad.`,
  }),
  extraccionSimulada: {
    paso: 'extraccion',
    estado: 'simulado',
    detalle:
      'IA simulada (proveedor fake): propone el nivel esperado para la edad y una manifestación según palabras clave; no usa Bedrock.',
  },
  extraccionClaude: (modelo: string, conGuardrail: boolean): Paso => ({
    paso: 'extraccion',
    estado: 'completado',
    detalle: conGuardrail
      ? `El Guardrail anonimizó los datos personales y Claude (${modelo}) en Amazon Bedrock propuso nivel y manifestaciones del catálogo.`
      : `Claude (${modelo}) en Amazon Bedrock propuso nivel y manifestaciones del catálogo, sin Guardrail configurado.`,
  }),
} satisfies Record<string, Paso | ((...args: never[]) => Paso)>;

/** Lo que se procesó: la entrada recibida y el estado de cada paso. */
export function describirProcesamiento(
  formato: 'texto' | 'audio' | 'foto',
  texto: string | null,
  archivo: { clave: string; tipo: string; bytes: number } | undefined,
  pasos: Paso[],
): Procesamiento {
  return {
    simulado: pasos.some((p) => p.estado !== 'completado'),
    entrada: {
      formato,
      tipoArchivo: archivo?.tipo ?? null,
      bytes: archivo?.bytes ?? Buffer.byteLength(texto ?? '', 'utf8'),
      claveS3: archivo?.clave ?? null,
    },
    pasos,
  };
}
