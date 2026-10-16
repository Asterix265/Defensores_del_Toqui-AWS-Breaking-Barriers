import type { BorradorEntrante } from '@toqui/shared';
import { normalizarTexto } from './normalizacion.js';
import {
  borradorInsuficiente,
  entregar,
  textoSinEvidencia,
  validarImagen,
  type ContextoExtraccion,
  type FormatoImagen,
  type IaProvider,
} from './proveedor.js';
import { ubicarCita, validar } from './validacion.js';

/** Lecturas simuladas de foto (sintéticas). */
const LECTURAS_FOTO = [
  'Apiló 4 bloques de espuma solo y aplaudió cuando no se cayeron.',
  'Gateó hasta el sonajero y lo agitó para que sonara.',
];

const LARGO_CITA = 160;
const LARGO_PREFIJO = 5;
const LARGO_MINIMO_PALABRA = 4;
const COINCIDENCIAS_MINIMAS = 2;

/** Prefijos de las palabras de 4 o más letras, en minúsculas y sin tildes. */
function prefijos(texto: string): Set<string> {
  const palabras = texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length >= LARGO_MINIMO_PALABRA);
  return new Set(palabras.map((p) => p.slice(0, LARGO_PREFIJO)));
}

/** Primera oración del texto (o su comienzo): siempre es un fragmento literal del texto. */
function citaDe(texto: string): string {
  const fin = texto.search(/[.!?](\s|$)/);
  const oracion = fin >= 0 ? texto.slice(0, fin + 1) : texto;
  return oracion.slice(0, LARGO_CITA).trim();
}

function semilla(bytes: Uint8Array): number {
  let h = 0;
  for (const byte of bytes) h = (h * 31 + byte) >>> 0;
  return h;
}

/**
 * Determinista y sin red: elige la manifestación del nivel esperado que más palabras comparte
 * con la nota. No conoce núcleos ni dominios; solo usa el catálogo recibido.
 */
export class ProveedorFake implements IaProvider {
  readonly nombre = 'fake' as const;

  async extraer(texto: string, contexto: ContextoExtraccion): Promise<BorradorEntrante> {
    const nota = normalizarTexto(texto);
    if (textoSinEvidencia(nota)) return borradorInsuficiente(nota, 'fake');

    const deLaNota = prefijos(nota);
    let mejor: { id: string; puntaje: number } | undefined;
    for (const m of contexto.catalogo) {
      if (m.nivel !== contexto.nivelEsperado) continue;
      let puntaje = 0;
      for (const p of prefijos(m.textoObservable)) if (deLaNota.has(p)) puntaje++;
      if (!mejor || puntaje > mejor.puntaje || (puntaje === mejor.puntaje && m.id < mejor.id)) {
        mejor = { id: m.id, puntaje };
      }
    }
    if (!mejor || mejor.puntaje < COINCIDENCIAS_MINIMAS) return borradorInsuficiente(nota, 'fake');

    const cita = ubicarCita(citaDe(nota), nota);
    if (cita === null) return borradorInsuficiente(nota, 'fake');
    const resultado = validar(
      {
        evidenciaInsuficiente: false,
        nivel: contexto.nivelEsperado,
        manifestaciones: [{ idManifestacion: mejor.id, cita }],
      },
      nota,
      contexto,
    );
    if (!resultado.ok) return borradorInsuficiente(nota, 'fake');
    return entregar({ ...resultado.borrador, proveedor: 'fake' });
  }

  async normalizarFoto(imagen: Uint8Array, formato: FormatoImagen): Promise<string> {
    validarImagen(imagen, formato);
    return LECTURAS_FOTO[semilla(imagen) % LECTURAS_FOTO.length]!;
  }
}
