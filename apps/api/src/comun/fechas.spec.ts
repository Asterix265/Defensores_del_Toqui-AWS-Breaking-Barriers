import { aColumnaFecha, desdeColumnaFecha, edadEnMeses, hoyEn, sumarDias } from './fechas';

describe('fechas', () => {
  it('usa el día de Chile y no el de UTC', () => {
    // 02:00 UTC del 16 de octubre todavía es 15 de octubre en Santiago.
    expect(hoyEn('America/Santiago', new Date('2026-10-16T02:00:00Z'))).toBe('2026-10-15');
  });

  it('ida y vuelta con la columna DATE', () => {
    expect(desdeColumnaFecha(aColumnaFecha('2026-10-15'))).toBe('2026-10-15');
  });
});

describe('edadEnMeses', () => {
  it('sigue la fórmula del diccionario', () => {
    expect(edadEnMeses('2025-01-01', '2026-08-03')).toBe(19);
    expect(edadEnMeses('2025-01-15', '2025-03-14')).toBe(1);
    expect(edadEnMeses('2025-01-15', '2025-03-15')).toBe(2);
  });

  it('suma días cruzando meses', () => {
    expect(sumarDias('2026-10-15', -30)).toBe('2026-09-15');
  });
});
