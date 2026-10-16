/**
 * Nivel estimado por núcleo, nivel promedio y rezago relativo dentro de la sala. Son
 * estimaciones pedagógicas para revisión de la educadora, no diagnósticos: un núcleo sin
 * registros queda sin nivel (nunca como nivel bajo) y no cuenta para el promedio ni el rezago.
 */
import type { TrayectoriaApi } from './api';
import { NUCLEOS, type Nino, type Nucleo } from './datos';

/**
 * Nivel general del niño o niña: promedio aritmético simple de los núcleos con nivel, todos con
 * el mismo peso (decisión del equipo; el FAQ, H4.4, habla de promedio de los núcleos). Los núcleos
 * sin nivel no cuentan. No es una ponderación clínica ni usa pesos por núcleo.
 */
export const AVISO_PROMEDIO_SIMPLE =
  'Nivel promedio simple: promedio aritmético de los núcleos con nivel, todos con el mismo peso; los núcleos sin registros no cuentan.';

/** Niveles bajo la mediana de la sala desde los que un núcleo se marca para revisar. */
export const DIFERENCIA_REZAGO = 2;
/** Niños o niñas con nivel en el núcleo que hacen falta para comparar con la sala. */
export const MINIMO_COMPARABLES = 3;

export interface NivelNucleo {
  nivel: number;
  /** El nivel lo validó una educadora (no es solo la sugerencia). */
  validado: boolean;
  /** Fecha `AAAA-MM-DD` de la valoración u observación de la que sale. */
  fecha: string;
}

export interface EstadoNino {
  niveles: Partial<Record<Nucleo, NivelNucleo>>;
  /**
   * Promedio simple de los núcleos con nivel, con igual peso (ver `AVISO_PROMEDIO_SIMPLE`);
   * `null` sin ninguno.
   */
  promedio: number | null;
}

/**
 * Nivel por núcleo: el de la valoración más reciente con nivel (el validado o, si no hay, el
 * sugerido). Sin valoraciones en el núcleo, el nivel de la observación más reciente que lo
 * registra (el que confirmó la educadora).
 */
export function estadoNino(t: Pick<TrayectoriaApi, 'nucleos' | 'observaciones'>): EstadoNino {
  const niveles: Partial<Record<Nucleo, NivelNucleo>> = {};
  for (const { nucleo, valoraciones } of t.nucleos) {
    const ultima = valoraciones
      .filter((v) => (v.nivelValidado ?? v.nivelSugerido) !== null)
      .sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte))
      .at(-1);
    if (ultima) {
      niveles[nucleo as Nucleo] = {
        nivel: (ultima.nivelValidado ?? ultima.nivelSugerido) as number,
        validado: ultima.nivelValidado !== null,
        fecha: ultima.fechaCorte,
      };
    }
  }
  const observaciones = [...t.observaciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  for (const nucleo of NUCLEOS) {
    if (niveles[nucleo]) continue;
    for (const o of observaciones) {
      const m = o.manifestaciones.find((x) => x.nucleo === nucleo);
      if (m) {
        niveles[nucleo] = { nivel: m.nivel, validado: o.origen === 'app', fecha: o.fecha };
        break;
      }
    }
  }
  const valores = Object.values(niveles).map((n) => n.nivel);
  const promedio = valores.length ? valores.reduce((s, n) => s + n, 0) / valores.length : null;
  return { niveles, promedio };
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2;
}

/**
 * Rezago relativo (FAQ de Integra): un núcleo se marca cuando el niño o niña está
 * `DIFERENCIA_REZAGO` niveles o más bajo la mediana de su sala y nivel educativo en ese núcleo.
 * Si 8 de 10 están en el nivel 5 y 2 en el nivel 2, se marcan esos 2. Devuelve, por id, los
 * núcleos marcados (solo los niños o niñas con alguno).
 */
export function rezagosDeSala(
  ninos: Nino[],
  estados: Map<string, EstadoNino>,
): Map<string, Nucleo[]> {
  const rezagos = new Map<string, Nucleo[]>();
  const grupos = new Map<string, Nino[]>();
  for (const n of ninos) {
    const clave = `${n.sala}|${n.nivelEducativo}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), n]);
  }
  for (const grupo of grupos.values()) {
    for (const nucleo of NUCLEOS) {
      const conNivel = grupo.flatMap((n) => {
        const nivel = estados.get(n.id)?.niveles[nucleo]?.nivel;
        return nivel === undefined ? [] : [{ id: n.id, nivel }];
      });
      if (conNivel.length < MINIMO_COMPARABLES) continue;
      const referencia = mediana(conNivel.map((c) => c.nivel))!;
      for (const { id, nivel } of conNivel) {
        if (referencia - nivel >= DIFERENCIA_REZAGO)
          rezagos.set(id, [...(rezagos.get(id) ?? []), nucleo]);
      }
    }
  }
  return rezagos;
}

export interface ResumenSala {
  sala: string;
  nivelEducativo: Nino['nivelEducativo'] | null;
  ninos: number;
  edadMin: number | null;
  edadMax: number | null;
  edadPromedio: number | null;
  /**
   * Promedio simple de los niveles promedio de quienes tienen alguno: cada niño o niña con nivel
   * pesa igual.
   */
  nivelPromedio: number | null;
  /** Niños o niñas con algún núcleo bajo su sala. */
  paraRevisar: number;
  /** Niños o niñas sin ningún nivel registrado. */
  sinNivel: number;
  /** Niños o niñas cuya trayectoria no se cargó: con alguno, las métricas son parciales. */
  sinCargar: number;
}

export function resumenSala(
  sala: string,
  ninos: Nino[],
  estados: Map<string, EstadoNino>,
  rezagos: Map<string, Nucleo[]>,
): ResumenSala {
  const deSala = ninos.filter((n) => n.sala === sala);
  const edades = deSala.map((n) => n.edadMeses);
  const promedios = deSala.flatMap((n) => {
    const p = estados.get(n.id)?.promedio;
    return p === null || p === undefined ? [] : [p];
  });
  const promedio = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
  return {
    sala,
    nivelEducativo: deSala[0]?.nivelEducativo ?? null,
    ninos: deSala.length,
    edadMin: edades.length ? Math.min(...edades) : null,
    edadMax: edades.length ? Math.max(...edades) : null,
    edadPromedio: promedio(edades),
    nivelPromedio: promedio(promedios),
    paraRevisar: deSala.filter((n) => rezagos.has(n.id)).length,
    sinNivel: deSala.filter((n) => estados.has(n.id) && estados.get(n.id)!.promedio === null)
      .length,
    sinCargar: deSala.filter((n) => !estados.has(n.id)).length,
  };
}

/** 4.25 → «4,3». */
export function formatoNivel(nivel: number): string {
  return nivel.toLocaleString('es-CL', { maximumFractionDigits: 1 });
}

/** 20 → «20 meses»; 31 → «2 años 7 meses». */
export function formatoEdad(meses: number): string {
  const m = Math.round(meses);
  if (m < 24) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  const anios = Math.floor(m / 12);
  const resto = m % 12;
  return resto ? `${anios} años ${resto} ${resto === 1 ? 'mes' : 'meses'}` : `${anios} años`;
}
