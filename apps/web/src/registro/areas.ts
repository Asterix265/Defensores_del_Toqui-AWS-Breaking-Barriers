import { DOMINIOS, type Dominio, type Nota } from './datos';

/** Ventana de los huecos de evidencia (la que propone `definir-mvp-e1`). */
export const DIAS_PERIODO = 30;

export interface ResumenArea {
  area: Dominio;
  cantidad: number;
  ultima: Date | null;
}

/**
 * Notas de un niño o niña por área en los últimos 30 días. Las áreas sin notas van primero
 * (son la sugerencia de observación); el resto, de más a menos notas y, a igual cantidad,
 * la más reciente primero.
 * Cuenta registros, no logros: un área en 0 significa «sin notas», no «no alcanzado».
 */
export function resumenAreas(notas: Nota[], ninoId: string, ahora: Date): ResumenArea[] {
  const limite = ahora.getTime() - DIAS_PERIODO * 24 * 60 * 60 * 1000;
  const recientes = notas.filter((n) => n.ninoId === ninoId && n.creada.getTime() >= limite);
  return DOMINIOS.map((area) => {
    const delArea = recientes.filter((n) => n.area === area);
    const ultima = delArea.reduce<Date | null>(
      (max, n) => (!max || n.creada > max ? n.creada : max),
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
