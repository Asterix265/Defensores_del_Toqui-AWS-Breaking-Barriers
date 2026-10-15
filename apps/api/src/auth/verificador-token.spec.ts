import type { Env } from '../config/env';
import { rolDesdeGrupos } from './identidad';
import { VerificadorToken } from './verificador-token';

describe('rolDesdeGrupos', () => {
  it('prioriza supervisor y rechaza grupos desconocidos', () => {
    expect(rolDesdeGrupos(['registrador', 'supervisor'])).toBe('supervisor');
    expect(rolDesdeGrupos(['registrador'])).toBe('registrador');
    expect(rolDesdeGrupos(['otro'])).toBeNull();
    expect(rolDesdeGrupos(undefined)).toBeNull();
  });
});

describe('VerificadorToken en modo dev', () => {
  const verificador = new VerificadorToken({ AUTH_MODO: 'dev' } as Env);

  it('acepta dev:<rol>:<sub>', async () => {
    await expect(verificador.verificar('dev:supervisor:ana')).resolves.toEqual({
      ok: true,
      identidad: { id: 'ana', rol: 'supervisor', nombre: 'ana', telefono: null },
    });
  });

  it('rechaza otros formatos y roles', async () => {
    for (const token of ['dev:admin:ana', 'ana', 'dev:registrador:../x']) {
      await expect(verificador.verificar(token)).resolves.toEqual({
        ok: false,
        motivo: 'token_invalido',
      });
    }
  });
});
