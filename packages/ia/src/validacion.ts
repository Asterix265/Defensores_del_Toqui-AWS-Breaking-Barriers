import { z } from 'zod';
import type { BorradorEntrante } from '@toqui/shared';
import type { ContextoExtraccion } from './proveedor.js';

/** Lo que devuelve el modelo (herramienta `registrar_borrador`) antes de validarlo. */
export const PropuestaSchema = z.object({
  evidenciaInsuficiente: z.boolean(),
  nivel: z.number().int().nullable().optional(),
  manifestaciones: z
    .array(z.object({ idManifestacion: z.string(), cita: z.string() }))
    .optional()
    .default([]),
});
export type Propuesta = z.infer<typeof PropuestaSchema>;

export const MAXIMO_MANIFESTACIONES = 5;

export type ResultadoValidacion =
  | { ok: true; borrador: Omit<BorradorEntrante, 'proveedor' | 'modelo'> }
  | { ok: false; problemas: string[] };

/**
 * Devuelve el fragmento literal de `texto` que corresponde a la cita, o null. Tolera
 * diferencias de mayúsculas, espacios repetidos y comillas o puntuación en los extremos, que
 * los modelos suelen introducir; lo devuelto siempre está tal cual en el texto.
 */
export function ubicarCita(texto: string, cita: string): string | null {
  const limpia = cita
    .trim()
    .replace(/^["'«“”]+|["'»“”]+$/g, '')
    .trim();
  if (!limpia) return null;
  if (texto.includes(limpia)) return limpia;
  const partes = limpia
    .replace(/[.,;:!?…]+$/u, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (partes.length === 0) return null;
  const encontrada = new RegExp(partes.join('\\s+'), 'iu').exec(texto);
  return encontrada ? encontrada[0] : null;
}

/**
 * D7: IDs del catálogo entregado, todos del nivel propuesto (esperado ±1), entre 1 y 5 sin
 * repetir, y cada cita presente en el texto.
 */
export function validarPropuesta(
  entrada: unknown,
  textoFuente: string,
  contexto: ContextoExtraccion,
): ResultadoValidacion {
  const analizada = PropuestaSchema.safeParse(entrada);
  if (!analizada.success) {
    return { ok: false, problemas: [`formato inválido: ${z.prettifyError(analizada.error)}`] };
  }
  const propuesta = analizada.data;
  if (propuesta.evidenciaInsuficiente) {
    return {
      ok: true,
      borrador: {
        textoFuente,
        nivelSugerido: null,
        evidenciaInsuficiente: true,
        manifestaciones: [],
      },
    };
  }

  const problemas: string[] = [];
  const nivel = propuesta.nivel ?? null;
  const niveles = new Set(contexto.catalogo.map((m) => m.nivel));
  if (nivel === null) problemas.push('falta el nivel');
  else if (!niveles.has(nivel)) {
    problemas.push(`el nivel ${nivel} no está entre los niveles del catálogo entregado`);
  }

  const lista = propuesta.manifestaciones;
  if (lista.length === 0) problemas.push('faltan manifestaciones');
  if (lista.length > MAXIMO_MANIFESTACIONES) {
    problemas.push(`hay ${lista.length} manifestaciones; el máximo es ${MAXIMO_MANIFESTACIONES}`);
  }
  if (new Set(lista.map((m) => m.idManifestacion)).size !== lista.length) {
    problemas.push('hay manifestaciones repetidas');
  }

  const catalogo = new Map(contexto.catalogo.map((m) => [m.id, m]));
  const manifestaciones: BorradorEntrante['manifestaciones'] = [];
  for (const m of lista) {
    const encontrada = catalogo.get(m.idManifestacion);
    if (!encontrada) {
      problemas.push(`${m.idManifestacion} no está en el catálogo`);
      continue;
    }
    if (nivel !== null && encontrada.nivel !== nivel) {
      problemas.push(`${m.idManifestacion} es del nivel ${encontrada.nivel}, no del ${nivel}`);
    }
    const cita = ubicarCita(textoFuente, m.cita);
    if (!cita) {
      problemas.push(`la cita de ${m.idManifestacion} no aparece literalmente en la nota`);
      continue;
    }
    manifestaciones.push({ idManifestacion: m.idManifestacion, cita });
  }

  if (problemas.length > 0) return { ok: false, problemas };
  return {
    ok: true,
    borrador: { textoFuente, nivelSugerido: nivel, evidenciaInsuficiente: false, manifestaciones },
  };
}
