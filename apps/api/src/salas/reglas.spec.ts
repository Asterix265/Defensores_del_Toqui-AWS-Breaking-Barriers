import type { NivelVigente } from '@toqui/shared';
import {
  alertasDeSalas,
  alertasIndividuales,
  decisionesVigentes,
  mediana,
  resumirNucleo,
} from './reglas';

const vigente = (idNino: string, nivel: number, nucleo = 'IA'): NivelVigente => ({
  idNino,
  nucleo,
  nivel,
  fechaCorte: '2026-10-15',
});

describe('reglas de alertas', () => {
  it('mediana de posiciones ordinales', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 5, 6, 3])).toBe(4.5);
  });

  it('alerta con pares suficientes', () => {
    const niveles = [5, 5, 5, 6, 4, 6].map((n, i) => vigente(`N${i}`, n)).concat(vigente('X', 3));
    expect(alertasIndividuales(niveles)).toEqual([
      { idNino: 'X', nucleo: 'IA', nivelValidado: 3, referencia: 5, brecha: 2, pares: 6 },
    ]);
  });

  it('sin alerta con menos de 5 pares', () => {
    const niveles = [6, 6, 6, 6].map((n, i) => vigente(`N${i}`, n)).concat(vigente('X', 1));
    expect(alertasIndividuales(niveles)).toEqual([]);
  });

  it('una decisión de más de 45 días no es vigente y se usa la última', () => {
    const vigentes = decisionesVigentes(
      [
        {
          idNino: 'A',
          nucleo: 'IA',
          nivel: 2,
          fechaCorte: '2026-08-15',
          fechaDecision: '2026-08-15',
        },
        { idNino: 'B', nucleo: 'IA', nivel: 3, fechaCorte: '2026-09-15', fechaDecision: null },
        { idNino: 'B', nucleo: 'IA', nivel: 4, fechaCorte: '2026-10-15', fechaDecision: null },
        { idNino: 'C', nucleo: 'IA', nivel: 5, fechaCorte: '2026-10-20', fechaDecision: null },
      ],
      '2026-10-15',
    );
    expect(vigentes).toEqual([{ idNino: 'B', nucleo: 'IA', nivel: 4, fechaCorte: '2026-10-15' }]);
  });

  it('resumen del núcleo con modas empatadas', () => {
    const resumen = resumirNucleo('IA', [vigente('A', 2), vigente('B', 4), vigente('C', 3)], 5);
    expect(resumen).toMatchObject({ conDecision: 3, sinDecision: 2, mediana: 3, modas: [2, 3, 4] });
  });

  it('alerta de sala frente a la otra sala equivalente', () => {
    const sala = (idSala: string, m: number | null) => ({
      idSala,
      nucleos: [
        { nucleo: 'CC', conDecision: 1, sinDecision: 0, distribucion: [], mediana: m, modas: [] },
      ],
    });
    const alertas = alertasDeSalas([sala('NM-01', 5.5), sala('NM-02', 3.5)]);
    expect(alertas.get('NM-02')).toEqual([
      { nucleo: 'CC', mediana: 3.5, referencia: 5.5, brecha: 2, salasReferencia: 1 },
    ]);
    expect(alertas.get('NM-01')).toEqual([]);
    // Una sola sala con información no se compara.
    expect(alertasDeSalas([sala('NM-01', 5), sala('NM-02', null)]).get('NM-01')).toEqual([]);
  });
});
