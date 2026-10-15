import type { ObservacionApi } from './api';
import { DOMINIOS, dominiosDe, type Dominio, type Formato, type Nota } from './datos';

/** Ventana de los huecos de evidencia (la que propone `definir-mvp-e1`). */
export const DIAS_PERIODO = 30;

export interface ResumenArea {
  area: Dominio;
  cantidad: number;
  ultima: Date | null;
}

/** Registro de un niño o niña: observación de la API o nota guardada en esta sesión. */
export interface Registro {
  id: string;
  creada: Date;
  /** Lo observado: el texto de la nota o las manifestaciones de la observación. */
  texto: string;
  /** Nota breve del dataset, si la trae. */
  detalle: string | null;
  dominios: Dominio[];
  formato: Formato | 'video';
  /** Quién registró; null para el dataset, que no trae nombres. */
  autor: string | null;
}

/** «2026-10-13» → fecha local a mediodía, para no cambiar de día por la zona horaria. */
function desdeFecha(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(anio, mes - 1, dia, 12);
}

export function registroDeObservacion(o: ObservacionApi): Registro {
  return {
    id: o.id,
    creada: desdeFecha(o.fecha),
    texto: o.manifestaciones.map((m) => m.textoObservable).join(' · '),
    detalle: o.notaBreve,
    dominios: [...new Set(o.manifestaciones.map((m) => m.dominio as Dominio))],
    formato: o.formato,
    autor: null,
  };
}

export function registroDeNota(n: Nota): Registro {
  return {
    id: n.id,
    creada: n.creada,
    texto: n.texto,
    detalle: null,
    dominios: dominiosDe(n.manifestaciones),
    formato: n.formato,
    autor: n.educadora,
  };
}

/** Registros de la API y de la sesión, del más reciente al más antiguo. */
export function registrosDe(
  ninoId: string,
  observaciones: ObservacionApi[],
  notas: Nota[],
): Registro[] {
  return [
    ...notas.filter((n) => n.nino.id === ninoId).map(registroDeNota),
    ...observaciones.map(registroDeObservacion),
  ].sort((a, b) => b.creada.getTime() - a.creada.getTime());
}

/**
 * Registros por área en los últimos 30 días. Las áreas sin registros van primero
 * (son la sugerencia de observación); el resto, de más a menos y, a igual cantidad,
 * la más reciente primero. Un registro con varias áreas cuenta en cada una.
 * Cuenta registros, no logros: un área en 0 significa «sin notas», no «no alcanzado».
 */
export function resumenAreas(registros: Registro[], ahora: Date): ResumenArea[] {
  const limite = ahora.getTime() - DIAS_PERIODO * 24 * 60 * 60 * 1000;
  const recientes = registros.filter((r) => r.creada.getTime() >= limite);
  return DOMINIOS.map((area) => {
    const delArea = recientes.filter((r) => r.dominios.includes(area));
    const ultima = delArea.reduce<Date | null>(
      (max, r) => (!max || r.creada > max ? r.creada : max),
      null,
    );
    return { area, cantidad: delArea.length, ultima };
  }).sort((a, b) => {
    if ((a.cantidad === 0) !== (b.cantidad === 0)) return a.cantidad === 0 ? -1 : 1;
    return b.cantidad - a.cantidad || (b.ultima?.getTime() ?? 0) - (a.ultima?.getTime() ?? 0);
  });
}

export function areasSinNotas(resumen: ResumenArea[]): number {
  return resumen.filter((r) => r.cantidad === 0).length;
}
