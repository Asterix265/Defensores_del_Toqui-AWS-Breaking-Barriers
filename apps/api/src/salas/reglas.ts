import type {
  AlertaIndividual,
  AlertaSala,
  NivelVigente,
  ReglasAlerta,
  ResumenNucleo,
} from '@toqui/shared';
import { sumarDias } from '../comun/fechas';

/**
 * Reglas de demostración de `metodologia.md` (sección «Comparaciones y alertas») con los valores
 * de `configuracion.json` del dataset. Son configurables y no son criterios de Integra: una
 * alerta pide revisión contextual, no identifica rezago ni deriva.
 */
export const REGLAS: ReglasAlerta = {
  antiguedadMaximaDias: 45,
  paresMinimos: 5,
  brechaIndividual: 2,
  salasMinimas: 2,
  brechaSala: 1.5,
  accionIndividual:
    'Revisar evidencia, edad, oportunidades y apoyos con la educadora. Es una brecha respecto a la sala; no implica diagnóstico ni derivación automática.',
  accionSala:
    'La directora revisa composición de las salas, cobertura de registros, edades y oportunidades pedagógicas antes de definir apoyos.',
};

/** Valoración con nivel validado, tal como sale de la base (fechas `AAAA-MM-DD`). */
export interface DecisionValidada {
  idNino: string;
  nucleo: string;
  nivel: number;
  fechaCorte: string;
  /** Si falta, se usa la fecha de corte. */
  fechaDecision: string | null;
}

/** Mediana de valores ordinales (promedio de los dos centrales si la cantidad es par). */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio]! : (orden[medio - 1]! + orden[medio]!) / 2;
}

/**
 * Última decisión validada de cada niño o niña y núcleo al corte: `fechaCorte` ≤ corte y
 * decisión con antigüedad máxima de `antiguedadMaximaDias` (como `build_summaries` del dataset).
 */
export function decisionesVigentes(
  decisiones: DecisionValidada[],
  corte: string,
  reglas: ReglasAlerta = REGLAS,
): NivelVigente[] {
  const limite = sumarDias(corte, -reglas.antiguedadMaximaDias);
  const vigentes = new Map<string, DecisionValidada>();
  for (const d of decisiones) {
    const fechaDecision = d.fechaDecision ?? d.fechaCorte;
    if (d.fechaCorte > corte || fechaDecision < limite || fechaDecision > corte) continue;
    const clave = `${d.idNino}|${d.nucleo}`;
    const actual = vigentes.get(clave);
    const masReciente =
      !actual ||
      d.fechaCorte > actual.fechaCorte ||
      (d.fechaCorte === actual.fechaCorte &&
        fechaDecision >= (actual.fechaDecision ?? actual.fechaCorte));
    if (masReciente) vigentes.set(clave, d);
  }
  return [...vigentes.values()].map(({ idNino, nucleo, nivel, fechaCorte }) => ({
    idNino,
    nucleo,
    nivel,
    fechaCorte,
  }));
}

/** Resumen de un núcleo de la sala: cobertura, distribución, mediana y modas. */
export function resumirNucleo(
  nucleo: string,
  niveles: NivelVigente[],
  matriculados: number,
): ResumenNucleo {
  const delNucleo = niveles.filter((n) => n.nucleo === nucleo).map((n) => n.nivel);
  const conteo = new Map<number, number>();
  for (const nivel of delNucleo) conteo.set(nivel, (conteo.get(nivel) ?? 0) + 1);
  const maximo = Math.max(0, ...conteo.values());
  const distribucion = [...conteo.entries()]
    .sort(([a], [b]) => a - b)
    .map(([nivel, cantidad]) => ({ nivel, cantidad }));
  return {
    nucleo,
    conDecision: delNucleo.length,
    sinDecision: matriculados - delNucleo.length,
    distribucion,
    mediana: mediana(delNucleo),
    modas: distribucion.filter((d) => d.cantidad === maximo).map((d) => d.nivel),
  };
}

/**
 * Brecha individual relativa: nivel validado al menos `brechaIndividual` posiciones bajo la
 * mediana de al menos `paresMinimos` pares válidos de la sala, sin contar al niño o niña.
 */
export function alertasIndividuales(
  niveles: NivelVigente[],
  reglas: ReglasAlerta = REGLAS,
): AlertaIndividual[] {
  const alertas: AlertaIndividual[] = [];
  const nucleos = [...new Set(niveles.map((n) => n.nucleo))].sort();
  for (const nucleo of nucleos) {
    const delNucleo = niveles.filter((n) => n.nucleo === nucleo);
    for (const item of delNucleo) {
      const pares = delNucleo.filter((n) => n.idNino !== item.idNino).map((n) => n.nivel);
      if (pares.length < reglas.paresMinimos) continue;
      const referencia = mediana(pares)!;
      const brecha = referencia - item.nivel;
      if (brecha >= reglas.brechaIndividual) {
        alertas.push({
          idNino: item.idNino,
          nucleo,
          nivelValidado: item.nivel,
          referencia,
          brecha,
          pares: pares.length,
        });
      }
    }
  }
  return alertas;
}

/**
 * Brecha entre salas equivalentes (mismo jardín, nivel educativo y núcleo): con al menos
 * `salasMinimas` salas con mediana, contando la evaluada, se compara su mediana con la mediana
 * de las medianas de las otras.
 */
export function alertasDeSalas(
  salas: { idSala: string; nucleos: ResumenNucleo[] }[],
  reglas: ReglasAlerta = REGLAS,
): Map<string, AlertaSala[]> {
  const resultado = new Map<string, AlertaSala[]>(salas.map((s) => [s.idSala, []]));
  const nucleos = [...new Set(salas.flatMap((s) => s.nucleos.map((n) => n.nucleo)))].sort();
  for (const nucleo of nucleos) {
    const conMediana = salas.flatMap((s) => {
      const m = s.nucleos.find((n) => n.nucleo === nucleo)?.mediana;
      return m == null ? [] : [{ idSala: s.idSala, mediana: m }];
    });
    if (conMediana.length < reglas.salasMinimas) continue;
    for (const sala of conMediana) {
      const otras = conMediana.filter((s) => s.idSala !== sala.idSala).map((s) => s.mediana);
      const referencia = mediana(otras)!;
      const brecha = referencia - sala.mediana;
      if (brecha >= reglas.brechaSala) {
        resultado.get(sala.idSala)!.push({
          nucleo,
          mediana: sala.mediana,
          referencia,
          brecha,
          salasReferencia: otras.length,
        });
      }
    }
  }
  return resultado;
}
