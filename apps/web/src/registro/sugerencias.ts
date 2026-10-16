/**
 * Próximo paso a partir de una observación concreta de la tía. Usa lo que esa nota evidencia: la
 * cita de su texto, las manifestaciones vinculadas y si las mostró completas o en parte. El
 * paso cambia según la nota: afianzar lo que se vio en parte, completar lo que falta de la
 * misma conducta o, si ya se observó todo, lo que sigue en la rúbrica de su nivel educativo.
 * Es una sugerencia para la educadora, no una evaluación.
 */
import type { Manifestacion, ObservacionApi } from './api';
import { NUCLEOS, type Nino, type Nucleo } from './datos';

/** Manifestaciones sugeridas por área (no recarga la tarjeta). */
export const MAXIMO_SUGERIDAS = 2;

export type TipoSugerencia = 'afianzar' | 'completar' | 'avanzar' | 'tope';

type ManifestacionNota = ObservacionApi['manifestaciones'][number];

export interface Sugerencia {
  nucleo: Nucleo;
  nota: ObservacionApi;
  /** Lo que dijo la tía sobre esta área: la cita vinculada o, sin cita, el texto de la nota. */
  cita: string;
  /** Lo que la nota evidencia en el área. */
  observadas: ManifestacionNota[];
  tipo: TipoSugerencia;
  sugeridas: Manifestacion[];
}

/** El texto de la tía, su nota breve o, si no hay, las manifestaciones. */
export function textoDe(o: ObservacionApi): string {
  return (
    o.textoObservacion ?? o.notaBreve ?? o.manifestaciones.map((m) => m.textoObservable).join(' · ')
  );
}

/** Evidencias de la nota en el área; sin evidencias detalladas, sus manifestaciones completas. */
function evidenciasDe(nota: ObservacionApi, nucleo: Nucleo) {
  const detalladas = nota.evidencias.filter((e) => e.manifestacion.nucleo === nucleo);
  if (detalladas.length) return detalladas;
  return nota.manifestaciones
    .filter((m) => m.nucleo === nucleo)
    .map((manifestacion) => ({
      manifestacion,
      fragmento: null,
      alcance: 'componente_observado' as const,
    }));
}

/**
 * Sugerencia para una nota en un área, o `null` si la nota no evidencia nada del área.
 * `yaObservadas` son los ids de las manifestaciones ya vistas completas en alguna nota del niño o niña.
 */
export function sugerenciaDeNota(
  nota: ObservacionApi,
  nucleo: Nucleo,
  nino: Pick<Nino, 'nivelEducativo'>,
  catalogo: Manifestacion[],
  yaObservadas: Set<string>,
): Sugerencia | null {
  const evidencias = evidenciasDe(nota, nucleo);
  if (evidencias.length === 0) return null;
  // La conducta de más alto nivel que muestra esta nota es la referencia del próximo paso.
  const principal = evidencias.reduce((a, b) =>
    b.manifestacion.nivel > a.manifestacion.nivel ? b : a,
  );
  const observada = principal.manifestacion;
  const cita = evidencias.map((e) => e.fragmento).filter((f): f is string => Boolean(f));
  const base = {
    nucleo,
    nota,
    cita: cita.length ? cita.join(' … ') : textoDe(nota),
    observadas: evidencias.map((e) => e.manifestacion),
  };
  const mismaConducta = catalogo.filter(
    (m) => m.idDescriptor === observada.idDescriptor && !yaObservadas.has(m.id),
  );

  if (principal.alcance === 'parcial_otro_descriptor') {
    // Se vio en parte: primero afianzar esa misma conducta.
    const deLaConducta = catalogo.filter((m) => m.idDescriptor === observada.idDescriptor);
    return { ...base, tipo: 'afianzar', sugeridas: deLaConducta.slice(0, MAXIMO_SUGERIDAS) };
  }
  if (mismaConducta.length) {
    return { ...base, tipo: 'completar', sugeridas: mismaConducta.slice(0, MAXIMO_SUGERIDAS) };
  }
  const siguientes = catalogo.filter(
    (m) =>
      m.nucleo === nucleo &&
      m.nivelEducativo === nino.nivelEducativo &&
      m.nivel === observada.nivel + 1 &&
      !yaObservadas.has(m.id),
  );
  if (siguientes.length) {
    return { ...base, tipo: 'avanzar', sugeridas: siguientes.slice(0, MAXIMO_SUGERIDAS) };
  }
  return { ...base, tipo: 'tope', sugeridas: [] };
}

/** Por cada área, la sugerencia de la nota más reciente que la registra. */
export function sugerenciasDe(
  observaciones: ObservacionApi[],
  nino: Pick<Nino, 'nivelEducativo'>,
  catalogo: Manifestacion[],
): Sugerencia[] {
  const recientes = [...observaciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  // Observadas: con evidencia completa en alguna nota (o notas sin evidencias detalladas). Una
  // manifestación vista solo en parte no cuenta.
  const yaObservadas = new Set<string>();
  for (const o of observaciones) {
    if (o.evidencias.length === 0) for (const m of o.manifestaciones) yaObservadas.add(m.id);
    for (const e of o.evidencias) {
      if (e.alcance === 'componente_observado') yaObservadas.add(e.manifestacion.id);
    }
  }
  return NUCLEOS.flatMap((nucleo) => {
    for (const nota of recientes) {
      const sugerencia = sugerenciaDeNota(nota, nucleo, nino, catalogo, yaObservadas);
      if (sugerencia) return [sugerencia];
    }
    return [];
  });
}
