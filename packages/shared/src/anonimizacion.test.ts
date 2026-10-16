import { describe, expect, it } from 'vitest';
import { citaEnOriginal } from './anonimizacion.js';

const ORIGINAL = 'Prueba: Mateo apiló cuatro bloques y se los mostró a Sofía Pérez.';
const ANONIMIZADO = 'Prueba: {NAME} apiló cuatro bloques y se los mostró a {NAME}.';

describe('citaEnOriginal', () => {
  it('ubica en el original una cita con marcadores', () => {
    expect(citaEnOriginal('{NAME} apiló cuatro bloques', ANONIMIZADO, ORIGINAL)).toBe(
      'Mateo apiló cuatro bloques',
    );
    expect(citaEnOriginal('se los mostró a {NAME}', ANONIMIZADO, ORIGINAL)).toBe(
      'se los mostró a Sofía Pérez',
    );
  });

  it('una cita sin marcadores queda igual, en su lugar del original', () => {
    expect(citaEnOriginal('cuatro bloques', ANONIMIZADO, ORIGINAL)).toBe('cuatro bloques');
  });

  it('una cita que empieza o termina dentro de un marcador abarca el dato completo', () => {
    expect(citaEnOriginal('AME} apiló', ANONIMIZADO, ORIGINAL)).toBe('Mateo apiló');
    expect(citaEnOriginal('apiló cuatro', '{NAME} apiló cuatro', 'Ana apiló cuatro')).toBe(
      'apiló cuatro',
    );
  });

  it('marcadores al inicio, al final y de otros tipos', () => {
    expect(
      citaEnOriginal('{NAME} llamó a {PHONE}', '{NAME} llamó a {PHONE}', 'Ana llamó a 555-1234'),
    ).toBe('Ana llamó a 555-1234');
  });

  it('null si la cita no está o los textos no corresponden', () => {
    expect(citaEnOriginal('saltó', ANONIMIZADO, ORIGINAL)).toBeNull();
    expect(citaEnOriginal('{NAME} apiló', ANONIMIZADO, 'Otro texto distinto')).toBeNull();
  });

  it('sin anonimización el texto es el mismo', () => {
    expect(citaEnOriginal('apiló', ORIGINAL, ORIGINAL)).toBe('apiló');
  });
});
