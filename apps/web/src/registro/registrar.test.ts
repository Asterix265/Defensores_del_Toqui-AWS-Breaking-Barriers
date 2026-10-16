import { describe, expect, it } from 'vitest';
import { ESPERA_MAXIMA_MS } from './registrar';

describe('ESPERA_MAXIMA_MS', () => {
  it('el audio y la foto esperan más que el texto, y más que un intento de la Lambda (120 s)', () => {
    expect(ESPERA_MAXIMA_MS.texto).toBe(30_000);
    expect(ESPERA_MAXIMA_MS.audio).toBeGreaterThan(120_000);
    expect(ESPERA_MAXIMA_MS.foto).toBeGreaterThan(120_000);
  });
});
