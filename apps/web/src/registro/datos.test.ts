import { describe, expect, it } from 'vitest';
import { simularLectura, sugerirArea } from './datos';

describe('sugerirArea', () => {
  it('sugiere el dominio con más palabras clave, sin importar tildes ni mayúsculas', () => {
    expect(sugerirArea('APILÓ tres bloques')).toBe('motor_fino');
    expect(sugerirArea('Subió la rampa gateando')).toBe('motor_grueso');
    expect(sugerirArea('Dijo su primera palabra')).toBe('lenguaje_comunicacion');
  });

  it('no sugiere nada si no reconoce el texto', () => {
    expect(sugerirArea('Hoy llegó temprano')).toBeNull();
  });
});

describe('simularLectura', () => {
  it('rota las lecturas sintéticas según la semilla', () => {
    expect(simularLectura('foto', 0)).not.toEqual(simularLectura('foto', 1));
    expect(simularLectura('foto', 2)).toEqual(simularLectura('foto', 0));
  });
});
