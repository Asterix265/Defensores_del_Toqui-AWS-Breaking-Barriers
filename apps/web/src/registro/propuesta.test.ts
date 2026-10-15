import { describe, expect, it } from 'vitest';
import type { Manifestacion } from './api';
import { nivelEsperado, proponer } from './propuesta';
import { MANIFESTACIONES, NIVELES } from './prueba-api';

const catalogo = MANIFESTACIONES as Manifestacion[];

describe('nivelEsperado', () => {
  it('usa el rango de edad del nivel (mínimo incluido, máximo excluido) y el último si lo supera', () => {
    expect(nivelEsperado(0, NIVELES)).toBe(1);
    expect(nivelEsperado(18, NIVELES)).toBe(7);
    expect(nivelEsperado(23, NIVELES)).toBe(7);
    expect(nivelEsperado(48, NIVELES)).toBe(9);
  });
});

describe('proponer', () => {
  it('propone el nivel esperado y una manifestación de ese nivel con la cita literal', () => {
    const texto = 'Apiló tres bloques. Después aplaudió.';
    const propuesta = proponer(texto, 20, NIVELES, catalogo);
    expect(propuesta.nivel).toBe(7);
    expect(propuesta.manifestaciones).toHaveLength(1);
    expect(propuesta.manifestaciones[0]!.manifestacion.id).toBe('MAN-L07-MF-01');
    expect(propuesta.manifestaciones[0]!.cita).toBe('Apiló tres bloques.');
    expect(texto).toContain(propuesta.manifestaciones[0]!.cita);
  });

  it('con texto corto o sin pistas sale sin nivel ni manifestaciones (evidencia insuficiente)', () => {
    expect(proponer('Apiló bloques.', 20, NIVELES, catalogo)).toEqual({
      nivel: null,
      manifestaciones: [],
    });
    expect(proponer('Hoy llegó temprano al jardín.', 20, NIVELES, catalogo).nivel).toBeNull();
  });
});
