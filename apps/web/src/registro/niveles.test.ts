import { describe, expect, it } from 'vitest';
import type { TrayectoriaApi } from './api';
import type { Nino, Nucleo } from './datos';
import {
  estadoNino,
  formatoEdad,
  formatoNivel,
  mediana,
  rezagosDeSala,
  resumenSala,
  type EstadoNino,
} from './niveles';
import { ninosACsv, salasACsv } from './reporte';

type Valoracion = TrayectoriaApi['nucleos'][number]['valoraciones'][number];

function valoracion(
  fechaCorte: string,
  nivelSugerido: number | null,
  nivelValidado: number | null,
): Valoracion {
  return {
    id: `VAL-${fechaCorte}`,
    fechaCorte,
    nivelSugerido,
    nivelValidado,
    estado: nivelValidado === null ? 'propuesta_pendiente' : 'confirmada',
    origen: 'dataset',
  };
}

function nino(id: string, sala = 'SC-01', edadMeses = 20): Nino {
  return {
    id,
    nombre: id,
    nombreCompleto: `Niño ${id}`,
    iniciales: 'NN',
    sala,
    nivelEducativo: 'SC',
    edadMeses,
    fondo: '#fff',
    tinta: '#000',
  };
}

/** Estado con los niveles dados por núcleo. */
function estado(niveles: Partial<Record<Nucleo, number>>): EstadoNino {
  const valores = Object.values(niveles);
  return {
    niveles: Object.fromEntries(
      Object.entries(niveles).map(([n, nivel]) => [n, { nivel, validado: true, fecha: '' }]),
    ),
    promedio: valores.length ? valores.reduce((s, n) => s + n, 0) / valores.length : null,
  };
}

describe('estadoNino', () => {
  it('toma la valoración más reciente con nivel, prefiere el validado y promedia los núcleos', () => {
    const e = estadoNino({
      nucleos: [
        {
          nucleo: 'IA',
          sinRegistros: false,
          valoraciones: [
            valoracion('2026-05-01', 2, 2),
            valoracion('2026-09-01', 4, 3),
            valoracion('2026-10-01', null, null),
          ],
        },
        { nucleo: 'LV', sinRegistros: false, valoraciones: [valoracion('2026-09-01', 6, null)] },
        { nucleo: 'PM', sinRegistros: true, valoraciones: [] },
      ],
      observaciones: [],
    });
    expect(e.niveles.IA).toEqual({ nivel: 3, validado: true, fecha: '2026-09-01' });
    expect(e.niveles.LV).toEqual({ nivel: 6, validado: false, fecha: '2026-09-01' });
    // Sin registros no hay nivel (no es un nivel bajo).
    expect(e.niveles.PM).toBeUndefined();
    // Promedio simple con igual peso: (3 + 6) / 2; PM, sin registros, no cuenta.
    expect(e.promedio).toBe(4.5);
  });

  it('sin valoraciones usa la observación más reciente del núcleo', () => {
    const manifestacion = (nucleo: string, nivel: number) => ({
      id: `M-${nucleo}-${nivel}`,
      idDescriptor: 'D',
      nucleo,
      nivelEducativo: 'SC' as const,
      nivel,
      tipo: 'conducta_descriptor' as const,
      textoObservable: 'x',
    });
    const observacion = (fecha: string, nivel: number) => ({
      id: fecha,
      fecha,
      formato: 'texto' as const,
      origen: 'app' as const,
      notaBreve: null,
      textoObservacion: null,
      manifestaciones: [manifestacion('CM', nivel)],
      evidencias: [],
    });
    const e = estadoNino({
      nucleos: [],
      observaciones: [observacion('2026-09-01', 2), observacion('2026-10-01', 5)],
    });
    expect(e.niveles.CM?.nivel).toBe(5);
    expect(e.promedio).toBe(5);
  });

  it('sin registros queda sin promedio', () => {
    expect(estadoNino({ nucleos: [], observaciones: [] }).promedio).toBeNull();
  });
});

describe('rezagosDeSala', () => {
  it('marca a quienes quedan 2 niveles o más bajo la mediana de su sala (ejemplo del FAQ)', () => {
    const ninos = Array.from({ length: 10 }, (_, i) => nino(`N${i}`));
    const estados = new Map(ninos.map((n, i) => [n.id, estado({ LV: i < 8 ? 5 : 2, PM: 4 })]));
    const rezagos = rezagosDeSala(ninos, estados);
    expect([...rezagos.keys()]).toEqual(['N8', 'N9']);
    expect(rezagos.get('N8')).toEqual(['LV']);
  });

  it('no compara salas distintas ni grupos con menos de 3 niños o niñas con nivel', () => {
    const ninos = [nino('A1'), nino('A2'), nino('B1', 'SC-02'), nino('B2', 'SC-02')];
    const estados = new Map([
      ['A1', estado({ LV: 6 })],
      ['A2', estado({ LV: 1 })],
      ['B1', estado({ LV: 6 })],
      ['B2', estado({ LV: 6 })],
    ]);
    expect(rezagosDeSala(ninos, estados).size).toBe(0);
  });

  it('un niño o niña sin registros no se marca', () => {
    const ninos = [nino('A'), nino('B'), nino('C'), nino('D')];
    const estados = new Map([
      ['A', estado({ LV: 6 })],
      ['B', estado({ LV: 6 })],
      ['C', estado({ LV: 6 })],
      ['D', estado({})],
    ]);
    expect(rezagosDeSala(ninos, estados).size).toBe(0);
  });
});

describe('resumenSala', () => {
  it('cuenta niños y niñas, edades, nivel promedio, para revisar y sin nivel', () => {
    const ninos = [nino('A', 'SC-01', 12), nino('B', 'SC-01', 18), nino('C', 'SC-01', 24)];
    const estados = new Map([
      ['A', estado({ LV: 4, PM: 6 })],
      ['B', estado({ LV: 2 })],
      ['C', estado({})],
    ]);
    const r = resumenSala('SC-01', ninos, estados, new Map([['B', ['LV']]]));
    expect(r).toMatchObject({
      ninos: 3,
      edadMin: 12,
      edadMax: 24,
      edadPromedio: 18,
      // Promedio simple de los promedios de A (5) y B (2); C, sin nivel, no cuenta.
      nivelPromedio: 3.5,
      paraRevisar: 1,
      sinNivel: 1,
      sinCargar: 0,
    });
  });
});

describe('formatos', () => {
  it('formatea niveles, edades y medianas', () => {
    expect(formatoNivel(4.25)).toBe('4,3');
    expect(formatoEdad(20)).toBe('20 meses');
    expect(formatoEdad(31)).toBe('2 años 7 meses');
    expect(formatoEdad(36)).toBe('3 años');
    expect(mediana([5, 1, 3])).toBe(3);
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
});

describe('reportes CSV', () => {
  it('genera una fila por niño o niña con nivel por núcleo, promedio y núcleos bajo su sala', () => {
    const csv = ninosACsv(
      [nino('NINO-1')],
      new Map([['NINO-1', estado({ IA: 3, LV: 2 })]]),
      new Map([['NINO-1', ['LV']]]),
      new Map([['NINO-1', 6]]),
    ).split('\n');
    expect(csv[0]).toBe(
      'id_nino,nino,sala,nivel_educativo,edad_meses,nivel_IA,nivel_CC,nivel_CM,nivel_LV,nivel_LA,nivel_EN,nivel_ES,nivel_PM,nivel_promedio_simple,para_revisar,nucleos_bajo_su_sala,areas_sin_notas_30_dias',
    );
    expect(csv[1]).toBe('NINO-1,Niño NINO-1,Sala Cuna 1,SC,20,3,,,2,,,,,2.5,si,Lenguaje,6');
  });

  it('genera una fila por sala', () => {
    const csv = salasACsv([
      {
        sala: 'SC-01',
        nivelEducativo: 'SC',
        ninos: 3,
        edadMin: 12,
        edadMax: 24,
        edadPromedio: 18,
        nivelPromedio: 3.456,
        paraRevisar: 1,
        sinNivel: 0,
        sinCargar: 0,
        notas7Dias: 4,
      },
    ]).split('\n');
    expect(csv[1]).toBe('Sala Cuna 1,SC,3,12,24,18,3.5,1,0,4');
  });
});
