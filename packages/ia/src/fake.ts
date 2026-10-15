import type { BorradorEntrante, Dominio } from '@toqui/shared';
import {
  MINIMO_TEXTO,
  borradorInsuficiente,
  type ContextoExtraccion,
  type IaProvider,
} from './proveedor.js';

/** Mismas palabras clave que el mock de la web (`apps/web/src/registro/datos.ts`). */
const PALABRAS_CLAVE: Record<Dominio, string[]> = {
  lenguaje_comunicacion: ['dijo', 'palabra', 'cancion', 'hablo', 'balbuce', 'senalo', 'pidio'],
  motor_fino: ['bloque', 'apilo', 'pinza', 'lapiz', 'encaj', 'cuchara', 'boton'],
  motor_grueso: ['gate', 'camin', 'corri', 'rampa', 'salt', 'trep', 'pelota'],
  socioemocional: ['content', 'compart', 'abraz', 'llor', 'sonri', 'companer', 'consol'],
  cognitivo: ['busco', 'escond', 'encontr', 'orden', 'clasific', 'color', 'forma'],
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

export function dominioProbable(texto: string): Dominio | null {
  const limpio = normalizar(texto);
  let mejor: Dominio | null = null;
  let puntajeMejor = 0;
  for (const [dominio, palabras] of Object.entries(PALABRAS_CLAVE) as [Dominio, string[]][]) {
    const puntaje = palabras.filter((p) => limpio.includes(p)).length;
    if (puntaje > puntajeMejor) {
      mejor = dominio;
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
 * Borrador determinista y válido: el nivel esperado para la edad y una manifestación de ese
 * nivel en el dominio sugerido por palabras clave. Sin pista de dominio o con poco texto,
 * evidencia insuficiente.
 */
export function extraerFake(textoFuente: string, contexto: ContextoExtraccion): BorradorEntrante {
  const dominio = textoFuente.trim().length >= MINIMO_TEXTO ? dominioProbable(textoFuente) : null;
  const manifestacion = dominio
    ? contexto.catalogo
        .filter((m) => m.nivel === contexto.nivelEsperado && m.dominio === dominio)
        .sort((a, b) => a.id.localeCompare(b.id))[0]
    : undefined;
  if (!manifestacion) return borradorInsuficiente(textoFuente, 'fake');
  return {
    textoFuente,
    nivelSugerido: contexto.nivelEsperado,
    evidenciaInsuficiente: false,
    manifestaciones: [{ idManifestacion: manifestacion.id, cita: citaDe(textoFuente) }],
    proveedor: 'fake',
  };
}

export class ProveedorFake implements IaProvider {
  readonly nombre = 'fake';

  async extraer(texto: string, contexto: ContextoExtraccion): Promise<BorradorEntrante> {
    return extraerFake(texto, contexto);
  }
}
