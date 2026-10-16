import type { Clasificador, EntradaClasificacion, LectorImagen } from '../puertos.js';
import type { RespuestaClasificacion } from '../validacion.js';

/**
 * Proveedor `fake`: mismo criterio que `apps/api/src/pipeline/ia-fake.ts` (palabras clave por
 * núcleo del dataset E1, nivel de referencia del mensaje). Sirve para probar la cola de punta a
 * punta sin IA.
 */
const PALABRAS_CLAVE: Record<string, string[]> = {
  IA: ['solo', 'sola', 'zapato', 'vistio', 'eligio', 'necesit', 'se calm', 'llor'],
  CC: ['compart', 'turno', 'companer', 'ayudo', 'regla', 'consol', 'abraz'],
  CM: ['gate', 'camin', 'corri', 'rampa', 'salt', 'trep', 'pelota', 'bloque', 'apilo', 'pinza'],
  LV: ['dijo', 'palabra', 'hablo', 'balbuce', 'senalo', 'pidio', 'conto', 'pregunt'],
  LA: ['pint', 'dibuj', 'cancion', 'canto', 'bail', 'music', 'ritmo', 'sonaj'],
  EN: ['planta', 'agua', 'animal', 'insect', 'hoja', 'tierra', 'semilla'],
  ES: ['famil', 'mama', 'papa', 'abuel', 'fiesta', 'comunidad', 'oficio'],
  PM: ['conteo', 'numero', 'cuant', 'orden', 'clasific', 'forma', 'tamano', 'escond', 'encontr'],
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

function nucleoProbable(texto: string): string | null {
  const limpio = sinTildes(texto);
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
    const nucleo = textoFuente.trim().length >= MINIMO_TEXTO ? nucleoProbable(textoFuente) : null;
    const manifestacion = nucleo
      ? catalogo
          .filter((m) => m.nivel === nivelEsperado && m.nucleo === nucleo)
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
