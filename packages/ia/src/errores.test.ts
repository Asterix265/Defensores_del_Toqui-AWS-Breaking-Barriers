import { describe, expect, it } from 'vitest';
import { ErrorIa, type CodigoErrorIa } from './errores.js';

describe('ErrorIa', () => {
  it('es un Error con nombre ErrorIa, código y mensaje', () => {
    const error = new ErrorIa('FOTO_NO_VALIDA', 'La foto debe ser JPEG o PNG.');
    expect(error).toBeInstanceOf(ErrorIa);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ErrorIa');
    expect(error.codigo).toBe('FOTO_NO_VALIDA');
    expect(error.message).toBe('La foto debe ser JPEG o PNG.');
  });

  it.each<CodigoErrorIa>(['FOTO_NO_VALIDA', 'GUARDRAIL_NO_DISPONIBLE', 'CONFIGURACION_INVALIDA'])(
    'acepta el código %s',
    (codigo) => {
      expect(new ErrorIa(codigo, 'falla').codigo).toBe(codigo);
    },
  );
});
