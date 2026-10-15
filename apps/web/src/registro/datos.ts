/**
 * Tipos de «Registro Simple» y proveedor de IA simulado. Los niños, niñas, el catálogo y los
 * registros previos vienen de la API (`api.ts`); las notas nuevas aún viven en memoria.
 */
import type { Manifestacion } from './api';

export type Formato = 'audio' | 'foto' | 'texto';

/** Dominios del dataset sintético (ver docs/contexto-desafio.md). */
export type Dominio =
  'cognitivo' | 'lenguaje_comunicacion' | 'motor_fino' | 'motor_grueso' | 'socioemocional';

export interface Nino {
  id: string;
  /** Nombre corto para la interfaz («Antonella F.»). */
  nombre: string;
  nombreCompleto: string;
  iniciales: string;
  /** Código del grupo en el dataset (`SG-A`). */
  sala: string;
  edadMeses: number;
  fondo: string;
  tinta: string;
}

/** Manifestación del catálogo con la cita del texto que la respalda (null si la agregó la tía). */
export interface ManifestacionCitada {
  manifestacion: Manifestacion;
  cita: string | null;
}

export interface Nota {
  id: string;
  nino: Nino;
  /** Nombre de la tía que registró la nota. */
  educadora: string;
  formato: Formato;
  creada: Date;
  /** Duración de la grabación en segundos (solo audio). */
  duracion?: number;
  texto: string;
  /** Estimación pedagógica confirmada por la educadora, no un diagnóstico. */
  nivel: number;
  manifestaciones: ManifestacionCitada[];
  /** Propuesta del proveedor simulado, para comparar con la decisión final de la educadora. */
  sugerencia: { nivel: number | null; manifestaciones: string[] };
}

/** Dominios de las manifestaciones de la nota, sin repetir y en orden de aparición. */
export function dominiosDe(manifestaciones: { manifestacion: { dominio: Dominio } }[]): Dominio[] {
  return [...new Set(manifestaciones.map((m) => m.manifestacion.dominio))];
}

export const DOMINIOS: Dominio[] = [
  'lenguaje_comunicacion',
  'motor_fino',
  'motor_grueso',
  'socioemocional',
  'cognitivo',
];

export const ETIQUETA_DOMINIO: Record<Dominio, string> = {
  cognitivo: 'Cognitivo',
  lenguaje_comunicacion: 'Lenguaje',
  motor_fino: 'Motor fino',
  motor_grueso: 'Motor grueso',
  socioemocional: 'Socioemocional',
};

export const COLOR_DOMINIO: Record<Dominio, { fondo: string; tinta: string }> = {
  cognitivo: { fondo: '#F1E6FA', tinta: '#4f2a73' },
  lenguaje_comunicacion: { fondo: '#E3ECFA', tinta: '#1d3f73' },
  motor_fino: { fondo: '#FFF1DB', tinta: '#7a4300' },
  motor_grueso: { fondo: '#E6F4E7', tinta: '#005312' },
  socioemocional: { fondo: '#FDE8EA', tinta: '#92001c' },
};

/** Respuestas fijas que simulan la transcripción del audio y la lectura del post-it. */
const LECTURAS: Record<'audio' | 'foto', string[]> = {
  audio: [
    'Buscó el autito que tapé con el pañal y dijo “ba-ba-ba” mirando a su compañero.',
    'Se puso los zapatos sola después de la siesta y me los mostró contenta.',
  ],
  foto: [
    'Apiló 4 bloques de espuma solo y aplaudió cuando no se cayeron.',
    'Gateó hasta el sonajero y lo agitó para que sonara.',
  ],
};

export function simularLectura(formato: 'audio' | 'foto', semilla: number): string {
  const lista = LECTURAS[formato];
  return lista[semilla % lista.length] as string;
}

const PALABRAS_CLAVE: Record<Dominio, string[]> = {
  lenguaje_comunicacion: ['dijo', 'palabra', 'cancion', 'hablo', 'balbuce', 'senalo', 'pidio'],
  motor_fino: ['bloque', 'apilo', 'pinza', 'lapiz', 'encaj', 'cuchara', 'boton'],
  motor_grueso: ['gate', 'camin', 'corri', 'rampa', 'salt', 'trep', 'pelota'],
  socioemocional: ['content', 'compart', 'abraz', 'llor', 'sonri', 'companer', 'consol'],
  cognitivo: ['busco', 'escond', 'encontr', 'orden', 'clasific', 'color', 'forma'],
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Dominio más probable por palabras clave (mismas que el proveedor `fake` de la API).
 * Solo alimenta la propuesta simulada: la educadora siempre confirma o corrige.
 */
export function sugerirArea(texto: string): Dominio | null {
  const limpio = normalizar(texto);
  let mejor: Dominio | null = null;
  let mejorPuntaje = 0;
  for (const dominio of DOMINIOS) {
    const puntaje = PALABRAS_CLAVE[dominio].filter((p) => limpio.includes(p)).length;
    if (puntaje > mejorPuntaje) {
      mejor = dominio;
      mejorPuntaje = puntaje;
    }
  }
  return mejor;
}

export function nuevoId(): string {
  return `nota-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
