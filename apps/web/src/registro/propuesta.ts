import type { Manifestacion, NivelRuta } from './api';
import { sugerirArea, type ManifestacionCitada } from './datos';

/** Con menos caracteres que esto la propuesta sale con evidencia insuficiente (igual que la API). */
const MINIMO_TEXTO = 20;
const LARGO_CITA = 160;

export interface Propuesta {
  /** Estimación pedagógica; null con evidencia insuficiente. */
  nivel: number | null;
  manifestaciones: ManifestacionCitada[];
}

/** Nivel de la ruta cuyo rango de edad contiene la edad; el último si la supera. */
export function nivelEsperado(edadMeses: number, niveles: NivelRuta[]): number {
  const enRango = niveles.find((n) => edadMeses >= n.edadMinMeses && edadMeses < n.edadMaxMeses);
  return enRango?.nivel ?? niveles.at(-1)?.nivel ?? 1;
}

/** Primera oración del texto (la cita aparece literal en él). */
function citaDe(texto: string): string {
  const limpio = texto.trim();
  const oracion = /^[^.!?]+[.!?]?/.exec(limpio)?.[0] ?? limpio;
  return oracion.slice(0, LARGO_CITA);
}

/**
 * Proveedor de IA simulado, con la forma del borrador de la API: nivel esperado para la edad y
 * una manifestación de ese nivel en el dominio que sugieren las palabras clave, con su cita.
 * Se reemplaza por el procesamiento real (`POST /capturas`) cuando esté disponible.
 */
export function proponer(
  texto: string,
  edadMeses: number,
  niveles: NivelRuta[],
  catalogo: Manifestacion[],
): Propuesta {
  const nivel = nivelEsperado(edadMeses, niveles);
  const dominio = texto.trim().length >= MINIMO_TEXTO ? sugerirArea(texto) : null;
  const manifestacion = dominio
    ? catalogo.find((m) => m.nivel === nivel && m.dominio === dominio)
    : undefined;
  if (!manifestacion) return { nivel: null, manifestaciones: [] };
  return { nivel, manifestaciones: [{ manifestacion, cita: citaDe(texto) }] };
}
