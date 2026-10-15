import { describe, expect, it } from 'vitest';
import { areasSinNotas, resumenAreas } from './areas';
import type { Dominio, Nota } from './datos';

const ahora = new Date(2026, 9, 15, 12, 0);

function nota(ninoId: string, area: Dominio, diasAtras: number): Nota {
  const creada = new Date(ahora);
  creada.setDate(creada.getDate() - diasAtras);
  return {
    id: `${ninoId}-${area}-${diasAtras}`,
    ninoId,
    educadora: 'Mercedes',
    formato: 'texto',
    creada,
    texto: 'Nota sintética',
    area,
    sugerencia: { texto: 'Nota sintética', area },
  };
}

describe('resumenAreas', () => {
  const notas = [
    nota('demo-1', 'lenguaje_comunicacion', 0),
    nota('demo-1', 'lenguaje_comunicacion', 5),
    nota('demo-1', 'socioemocional', 3),
    nota('demo-1', 'cognitivo', 40),
    nota('demo-2', 'motor_grueso', 1),
  ];
  const resumen = resumenAreas(notas, 'demo-1', ahora);
  const de = (area: Dominio) => resumen.find((r) => r.area === area);

  it('cuenta las notas del niño o niña por área y guarda la fecha de la última', () => {
    expect(de('lenguaje_comunicacion')).toEqual({
      area: 'lenguaje_comunicacion',
      cantidad: 2,
      ultima: notas[0]!.creada,
    });
    expect(de('socioemocional')?.cantidad).toBe(1);
  });

  it('no cuenta notas de otros niños ni de hace más de 30 días', () => {
    expect(de('motor_grueso')).toEqual({ area: 'motor_grueso', cantidad: 0, ultima: null });
    expect(de('cognitivo')).toEqual({ area: 'cognitivo', cantidad: 0, ultima: null });
  });

  it('pone primero las áreas sin notas y luego de más a menos notas', () => {
    expect(resumen.map((r) => r.cantidad)).toEqual([0, 0, 0, 2, 1]);
    expect(areasSinNotas(resumen)).toBe(3);
  });
});
