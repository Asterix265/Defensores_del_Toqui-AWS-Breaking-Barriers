import { aColumnaFecha, desdeColumnaFecha, hoyEn } from './fechas';

describe('fechas', () => {
  it('usa el día de Chile y no el de UTC', () => {
    // 02:00 UTC del 16 de octubre todavía es 15 de octubre en Santiago.
    expect(hoyEn('America/Santiago', new Date('2026-10-16T02:00:00Z'))).toBe('2026-10-15');
  });

  it('ida y vuelta con la columna DATE', () => {
    expect(desdeColumnaFecha(aColumnaFecha('2026-10-15'))).toBe('2026-10-15');
  });
});
