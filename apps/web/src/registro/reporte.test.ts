import { describe, expect, it } from 'vitest';
import { aCsv } from './reporte';

describe('aCsv', () => {
  it('usa ; como separador y escapa comillas, separadores y saltos de línea', () => {
    const csv = aCsv(
      ['a', 'b'],
      [
        ['Dijo "agua"; luego', 'línea 1\nlínea 2'],
        ['simple', 'sí'],
      ],
    );
    expect(csv).toBe('a;b\r\n"Dijo ""agua""; luego";"línea 1\nlínea 2"\r\nsimple;sí');
  });

  it('conserva el número de columnas en cada fila', () => {
    const csv = aCsv(['x', 'y', 'z'], [['1;2', '', 'c']]);
    expect(csv.split('\r\n')[1]).toBe('"1;2";;c');
  });
});
