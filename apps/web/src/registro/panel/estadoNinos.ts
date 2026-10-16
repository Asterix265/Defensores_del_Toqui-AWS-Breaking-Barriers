import { useTrayectoriasDe } from '../api';
import { areasSinNotas, registrosDe, resumenAreas } from '../areas';
import type { Nino, Nucleo } from '../datos';
import { estadoNino, rezagosDeSala, type EstadoNino } from '../niveles';

/**
 * Estado de varios niños y niñas a partir de su trayectoria: nivel por núcleo, promedio, áreas
 * sin notas en 30 días y núcleos bajo su sala. Mientras alguna trayectoria carga no se calcula
 * el rezago, para no marcar a nadie comparando con una sala incompleta. Si alguna falla, su sala
 * queda incompleta: no se calcula su rezago y `completo` es falso (las vistas bloquean el CSV).
 */
export function useEstadoNinos(ninos: Nino[], ahora: Date) {
  const consultas = useTrayectoriasDe(ninos.map((n) => n.id));
  const estados = new Map<string, EstadoNino>();
  const sinNotas = new Map<string, number>();
  const fallidos = new Set<string>();
  ninos.forEach((nino, i) => {
    const consulta = consultas[i];
    if (consulta?.isError) fallidos.add(nino.id);
    if (!consulta?.isSuccess) return;
    estados.set(nino.id, estadoNino(consulta.data));
    sinNotas.set(
      nino.id,
      areasSinNotas(resumenAreas(registrosDe(consulta.data.observaciones), ahora)),
    );
  });
  const cargando = consultas.some((c) => c.isPending);
  const salasIncompletas = new Set(ninos.filter((n) => fallidos.has(n.id)).map((n) => n.sala));
  const rezagos: Map<string, Nucleo[]> = cargando
    ? new Map()
    : rezagosDeSala(
        ninos.filter((n) => !salasIncompletas.has(n.sala)),
        estados,
      );
  return {
    estados,
    sinNotas,
    rezagos,
    cargando,
    fallidos,
    salasIncompletas,
    /** Todas las trayectorias cargaron: las métricas y el CSV están completos. */
    completo: !cargando && fallidos.size === 0,
    reintentar: () => {
      for (const c of consultas) if (c.isError) void c.refetch();
    },
  };
}
