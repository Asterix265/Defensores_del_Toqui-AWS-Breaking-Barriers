import type { Dominio } from '@toqui/shared';
import type { Clasificador, EntradaClasificacion, LectorImagen } from '../puertos.js';
import type { RespuestaClasificacion } from '../validacion.js';

/**
 * Proveedor `fake`: mismo criterio que `apps/api/src/pipeline/ia-fake.ts` (palabras clave por
 * dominio, nivel esperado para la edad). Sirve para probar la cola de punta a punta sin IA.
 */
const PALABRAS_CLAVE: Record<Dominio, string[]> = {
  lenguaje_comunicacion: ['dijo', 'palabra', 'cancion', 'hablo', 'balbuce', 'senalo', 'pidio'],
  motor_fino: ['bloque', 'apilo', 'pinza', 'lapiz', 'encaj', 'cuchara', 'boton'],
  motor_grueso: ['gate', 'camin', 'corri', 'rampa', 'salt', 'trep', 'pelota'],
  socioemocional: ['content', 'compart', 'abraz', 'llor', 'sonri', 'companer', 'consol'],
  cognitivo: ['busco', 'escond', 'encontr', 'orden', 'clasific', 'color', 'forma'],
};

const LECTURAS_FOTO = [
  'Apiló 4 bloques de espuma solo y aplaudió cuando no se cayeron.',
  'Gateó hasta el sonajero y lo agitó para que sonara.',
];

const MINIMO_TEXTO = 20;
const LARGO_CITA = 160;

function sinTildes(texto: string): string {
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

function dominioProbable(texto: string): Dominio | null {
  const limpio = sinTildes(texto);
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

/** Primera oración (o su comienzo): siempre es un fragmento literal del texto. */
function citaDe(texto: string): string {
  const recortado = texto.trim();
  const fin = recortado.search(/[.!?](\s|$)/);
  const oracion = fin >= 0 ? recortado.slice(0, fin + 1) : recortado;
  return oracion.slice(0, LARGO_CITA).trim();
}

export class ClasificadorFake implements Clasificador {
  readonly proveedor = 'fake';

  async clasificar(entrada: EntradaClasificacion): Promise<RespuestaClasificacion> {
    const { textoFuente, nivelEsperado, catalogo } = entrada;
    const dominio = textoFuente.trim().length >= MINIMO_TEXTO ? dominioProbable(textoFuente) : null;
    const manifestacion = dominio
      ? catalogo
          .filter((m) => m.nivel === nivelEsperado && m.dominio === dominio)
          .sort((a, b) => a.id.localeCompare(b.id))[0]
      : undefined;
    if (!manifestacion) {
      return { nivelSugerido: null, evidenciaInsuficiente: true, manifestaciones: [] };
    }
    return {
      nivelSugerido: nivelEsperado,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: manifestacion.id, cita: citaDe(textoFuente) }],
    };
  }
}

/** Lectura simulada de la foto: una nota fija elegida por la captura. */
export class LectorImagenFake implements LectorImagen {
  readonly proveedor = 'fake';

  async leer({ idCaptura }: { idCaptura: string }): Promise<string> {
    return LECTURAS_FOTO[semilla(idCaptura) % LECTURAS_FOTO.length]!;
  }
}
