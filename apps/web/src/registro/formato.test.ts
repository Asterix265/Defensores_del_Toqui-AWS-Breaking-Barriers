import { describe, expect, it } from 'vitest';
import { textoLegible } from './formato';

describe('textoLegible', () => {
  it('muestra los marcadores del Guardrail como texto legible', () => {
    expect(textoLegible('{NAME} apiló bloques con {NAME}.')).toBe(
      '[nombre] apiló bloques con [nombre].',
    );
    expect(textoLegible('Avisar a {EMAIL} o {PHONE} en {ADDRESS}')).toBe(
      'Avisar a [correo] o [teléfono] en [dirección]',
    );
  });

  it('no cambia otras llaves ni el texto sin marcadores', () => {
    expect(textoLegible('Contó {1, 2, 3} y {OTRO}')).toBe('Contó {1, 2, 3} y {OTRO}');
  });
});
