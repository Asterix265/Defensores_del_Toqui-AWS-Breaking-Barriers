import { describe, expect, it } from 'vitest';
import { areasSinNotas, resumenAreas, type Registro } from './areas';
import type { Nucleo } from './datos';

const ahora = new Date(2026, 9, 15, 12, 0);

function registro(nucleos: Nucleo[], diasAtras: number): Registro {
  const creada = new Date(ahora);
  creada.setDate(creada.getDate() - diasAtras);
  return {
    id: `${nucleos.join('-')}-${diasAtras}`,
    creada,
    texto: 'Registro sintético',
    detalle: null,
    nucleos,
    formato: 'texto',
    origen: 'dataset',
  };
}

describe('resumenAreas', () => {
  const registros = [
    registro(['LV'], 0),
    registro(['LV', 'IA'], 5),
    registro(['IA'], 3),
    registro(['PM'], 40),
  ];
  const resumen = resumenAreas(registros, ahora);
  const de = (area: Nucleo) => resumen.find((r) => r.area === area);

  it('cuenta los registros por área (uno con varias áreas cuenta en cada una) y la fecha de la última', () => {
    expect(de('LV')).toEqual({
      area: 'LV',
      cantidad: 2,
      ultima: registros[0]!.creada,
    });
    expect(de('IA')).toEqual({
      area: 'IA',
      cantidad: 2,
      ultima: registros[2]!.creada,
    });
  });

  it('no cuenta registros de hace más de 30 días', () => {
    expect(de('PM')).toEqual({ area: 'PM', cantidad: 0, ultima: null });
  });

  it('pone primero las áreas sin registros y luego de más a menos, la más reciente primero', () => {
    expect(resumen.map((r) => r.area)).toEqual(['CC', 'CM', 'LA', 'EN', 'ES', 'PM', 'LV', 'IA']);
    expect(areasSinNotas(resumen)).toBe(6);
  });
});
