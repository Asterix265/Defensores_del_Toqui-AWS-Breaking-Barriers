import type { Env } from '../config/env';
import { grupoDesdeToken } from './identidad';
import { VerificadorToken } from './verificador-token';

describe('grupoDesdeToken', () => {
  it('prioriza directora y rechaza grupos desconocidos', () => {
    expect(grupoDesdeToken(['educadora', 'directora'])).toBe('directora');
    expect(grupoDesdeToken(['educadora'])).toBe('educadora');
    expect(grupoDesdeToken(['registrador'])).toBeNull();
    expect(grupoDesdeToken(undefined)).toBeNull();
  });
});

describe('VerificadorToken en modo local', () => {
  const verificador = new VerificadorToken({ AUTH_MODE: 'local' } as Env);

  it('acepta local:<grupo>:<jardín>[:<id>]', async () => {
    await expect(verificador.verificar('local:directora:JAR-0002:dora')).resolves.toMatchObject({
      ok: true,
      identidad: { id: 'dora', grupo: 'directora', idJardin: 'JAR-0002' },
    });
    await expect(verificador.verificar('local:educadora:JAR-0001')).resolves.toMatchObject({
      ok: true,
      identidad: { id: 'local-educadora-JAR-0001', grupo: 'educadora' },
    });
  });

  it('rechaza otros formatos, grupos y jardines', async () => {
    for (const token of [
      'local:admin:JAR-0001',
      'local:educadora:J1',
      'ana',
      'dev:registrador:ana',
    ]) {
      await expect(verificador.verificar(token)).resolves.toEqual({
        ok: false,
        motivo: 'token_invalido',
      });
    }
  });
});
