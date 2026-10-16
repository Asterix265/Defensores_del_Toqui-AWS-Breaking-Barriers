import type { BorradorEntrante, Manifestacion, Procesamiento } from '@toqui/shared';

/**
 * Palabras clave por núcleo del dataset E1 (mismas que `apps/pipeline/src/ia/fake.ts`). Solo
 * para la IA simulada: no reemplazan la rúbrica.
 */
export const PALABRAS_CLAVE: Record<string, string[]> = {
  IA: ['solo', 'sola', 'zapato', 'vistio', 'eligio', 'necesit', 'se calm', 'llor'],
  CC: ['compart', 'turno', 'companer', 'ayudo', 'regla', 'consol', 'abraz'],
  CM: ['gate', 'camin', 'corri', 'rampa', 'salt', 'trep', 'pelota', 'bloque', 'apilo', 'pinza'],
  LV: ['dijo', 'palabra', 'hablo', 'balbuce', 'senalo', 'pidio', 'conto', 'pregunt'],
  LA: ['pint', 'dibuj', 'cancion', 'canto', 'bail', 'music', 'ritmo', 'sonaj'],
  EN: ['planta', 'agua', 'animal', 'insect', 'hoja', 'tierra', 'semilla'],
  ES: ['famil', 'mama', 'papa', 'abuel', 'fiesta', 'comunidad', 'oficio'],
  PM: ['conteo', 'numero', 'cuant', 'orden', 'clasific', 'forma', 'tamano', 'escond', 'encontr'],
};

/** Lecturas simuladas para audio y foto cuando no hay Transcribe ni lectura de imágenes. */
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

/** Con menos caracteres que esto el borrador sale con evidencia insuficiente. */
const MINIMO_TEXTO = 20;
const LARGO_CITA = 160;

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function semilla(texto: string): number {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Texto normalizado simulado: el escrito, o una lectura fija elegida por la captura. */
export function normalizarFake(
  formato: 'texto' | 'audio' | 'foto',
  idCaptura: string,
  texto: string | null,
): string {
  if (formato === 'texto') return texto ?? '';
  const opciones = LECTURAS[formato];
  return opciones[semilla(idCaptura) % opciones.length]!;
}

export function nucleoProbable(texto: string): string | null {
  const limpio = normalizar(texto);
  let mejor: string | null = null;
  let puntajeMejor = 0;
  for (const [nucleo, palabras] of Object.entries(PALABRAS_CLAVE)) {
    const puntaje = palabras.filter((p) => limpio.includes(p)).length;
    if (puntaje > puntajeMejor) {
      mejor = nucleo;
      puntajeMejor = puntaje;
    }
  }
  return mejor;
}

/** Primera oración del texto (o su comienzo): siempre es un fragmento literal del texto. */
export function citaDe(texto: string): string {
  const recortado = texto.trim();
  const fin = recortado.search(/[.!?](\s|$)/);
  const oracion = fin >= 0 ? recortado.slice(0, fin + 1) : recortado;
  return oracion.slice(0, LARGO_CITA).trim();
}

/**
 * Borrador determinista y válido: el nivel de referencia y una manifestación de ese nivel en el
 * núcleo sugerido por palabras clave, dentro del catálogo del nivel educativo. Sin pista de
 * núcleo o con poco texto, evidencia insuficiente.
 */
export function extraerFake(
  textoFuente: string,
  nivelReferencia: number,
  catalogoDelNivel: Manifestacion[],
): BorradorEntrante {
  const nucleo = textoFuente.trim().length >= MINIMO_TEXTO ? nucleoProbable(textoFuente) : null;
  const manifestacion = nucleo
    ? catalogoDelNivel
        .filter((m) => m.nucleo === nucleo)
        .sort((a, b) => a.id.localeCompare(b.id))[0]
    : undefined;
  if (!manifestacion) {
    return {
      textoFuente,
      nivelSugerido: null,
      evidenciaInsuficiente: true,
      manifestaciones: [],
      proveedor: 'fake',
    };
  }
  return {
    textoFuente,
    nivelSugerido: nivelReferencia,
    evidenciaInsuficiente: false,
    manifestaciones: [{ idManifestacion: manifestacion.id, cita: citaDe(textoFuente) }],
    proveedor: 'fake',
  };
}

/**
 * Lo que declara el modo inline: la entrada recibida y que la transcripción y la lectura de la
 * foto no están implementadas (se usa un texto de ejemplo) y que la extracción es simulada.
 */
export function procesamientoFake(
  formato: 'texto' | 'audio' | 'foto',
  texto: string | null,
  archivo?: { clave: string; tipo: string; bytes: number },
): Procesamiento {
  const pasos: Procesamiento['pasos'] = [];
  if (formato === 'audio') {
    pasos.push({
      paso: 'transcripcion',
      estado: 'no_implementado',
      detalle:
        'Amazon Transcribe aún no está conectado: en vez de la transcripción del audio se usa un texto de ejemplo.',
    });
  }
  if (formato === 'foto') {
    pasos.push({
      paso: 'lectura_imagen',
      estado: 'no_implementado',
      detalle:
        'La lectura de imágenes aún no está conectada: en vez de lo escrito en la foto se usa un texto de ejemplo.',
    });
  }
  pasos.push({
    paso: 'extraccion',
    estado: 'simulado',
    detalle:
      'IA simulada (proveedor fake): propone el nivel de referencia y una manifestación del núcleo según palabras clave; no usa Bedrock.',
  });
  return {
    simulado: true,
    entrada: {
      formato,
      tipoArchivo: archivo?.tipo ?? null,
      bytes: archivo?.bytes ?? Buffer.byteLength(texto ?? '', 'utf8'),
      claveS3: archivo?.clave ?? null,
    },
    pasos,
  };
}
