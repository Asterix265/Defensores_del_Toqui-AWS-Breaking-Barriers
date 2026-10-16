import { describe, expect, it } from 'vitest';
import { mapearCita } from './citas.js';

describe('mapearCita', () => {
  it('mapea un marcador al nombre del texto original', () => {
    expect(mapearCita('{NAME} dijo mamá', '{NAME} dijo mamá', 'Martina Rojas dijo mamá')).toBe(
      'Martina Rojas dijo mamá',
    );
  });

  it('con un marcador al inicio no captura el texto previo', () => {
    expect(
      mapearCita(
        '{NAME} dijo mamá',
        'Hoy {NAME} dijo mamá al llegar.',
        'Hoy Persona Ficticia Uno dijo mamá al llegar.',
      ),
    ).toBe('Persona Ficticia Uno dijo mamá');
  });

  it('con un marcador al final captura el nombre completo', () => {
    expect(
      mapearCita(
        'dijo mamá a {NAME}',
        'Al despedirse dijo mamá a {NAME}. Luego se fue.',
        'Al despedirse dijo mamá a Persona Ficticia Dos. Luego se fue.',
      ),
    ).toBe('dijo mamá a Persona Ficticia Dos');
  });

  it('mapea varios marcadores distintos', () => {
    const anonimo = 'El apoderado de {NAME} (RUT {rut-chileno}) contó que {NAME} canta en casa.';
    const original =
      'El apoderado de Persona Ficticia Uno (RUT 11.111.111-1) contó que Persona Ficticia Uno canta en casa.';
    expect(mapearCita('(RUT {rut-chileno}) contó que {NAME} canta', anonimo, original)).toBe(
      '(RUT 11.111.111-1) contó que Persona Ficticia Uno canta',
    );
  });

  it('tolera mayúsculas, espacios y comillas en una cita con marcador', () => {
    expect(
      mapearCita('«{NAME}  DIJO mamá»', 'Hoy {NAME} dijo mamá.', 'Hoy Persona Ficticia dijo mamá.'),
    ).toBe('Persona Ficticia dijo mamá');
  });

  it('sin marcadores devuelve el fragmento tal cual está en el original', () => {
    expect(
      mapearCita(
        'apiló  CUATRO bloques',
        '{NAME} apiló cuatro bloques.',
        'Persona Ficticia apiló cuatro bloques.',
      ),
    ).toBe('apiló cuatro bloques');
  });

  it('trata como literales los caracteres especiales de expresiones regulares', () => {
    expect(
      mapearCita(
        '¿{NAME} (otra vez)?',
        'Preguntó ¿{NAME} (otra vez)? y rió.',
        'Preguntó ¿Persona Ficticia (otra vez)? y rió.',
      ),
    ).toBe('¿Persona Ficticia (otra vez)?');
  });

  it('devuelve null si la cita no se puede ubicar en el original', () => {
    expect(
      mapearCita('{NAME} corrió al patio', '{NAME} dijo mamá', 'Martina Rojas dijo mamá'),
    ).toBeNull();
    expect(mapearCita('saltó la cuerda', '{NAME} dijo mamá', 'Martina Rojas dijo mamá')).toBeNull();
  });
});
