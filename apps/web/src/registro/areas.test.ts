import { describe, expect, it } from 'vitest';
import { areasSinNotas, resumenAreas, type Registro } from './areas';
import type { Dominio } from './datos';

const ahora = new Date(2026, 9, 15, 12, 0);

function registro(dominios: Dominio[], diasAtras: number): Registro {
  const creada = new Date(ahora);
  creada.setDate(creada.getDate() - diasAtras);
  return {
    id: `${dominios.join('-')}-${diasAtras}`,
    creada,
    texto: 'Registro sintético',
    detalle: null,
    dominios,
    formato: 'texto',
    autor: null,
  };
}

describe('resumenAreas', () => {
  const registros = [
    registro(['lenguaje_comunicacion'], 0),
    registro(['lenguaje_comunicacion', 'socioemocional'], 5),
    registro(['socioemocional'], 3),
    registro(['cognitivo'], 40),
  ];
  const resumen = resumenAreas(registros, ahora);
  const de = (area: Dominio) => resumen.find((r) => r.area === area);

  it('cuenta los registros por área (uno con varias áreas cuenta en cada una) y la fecha de la última', () => {
    expect(de('lenguaje_comunicacion')).toEqual({
      area: 'lenguaje_comunicacion',
      cantidad: 2,
      ultima: registros[0]!.creada,
    });
    expect(de('socioemocional')).toEqual({
      area: 'socioemocional',
      cantidad: 2,
      ultima: registros[2]!.creada,
    });
  });

  it('no cuenta registros de hace más de 30 días', () => {
    expect(de('cognitivo')).toEqual({ area: 'cognitivo', cantidad: 0, ultima: null });
  });

  it('pone primero las áreas sin registros y luego de más a menos, la más reciente primero', () => {
    expect(resumen.map((r) => r.area)).toEqual([
      'motor_fino',
      'motor_grueso',
      'cognitivo',
      'lenguaje_comunicacion',
      'socioemocional',
    ]);
    expect(areasSinNotas(resumen)).toBe(3);
  });
});
