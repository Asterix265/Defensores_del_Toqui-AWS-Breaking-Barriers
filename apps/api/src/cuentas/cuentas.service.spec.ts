import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InvitarCuentaRequestSchema } from '@toqui/shared';
import type { Identidad } from '../auth/identidad';
import { CuentasService } from './cuentas.service';
import {
  CorreoYaRegistrado,
  InvitacionIncompleta,
  type DirectorioService,
  type UsuarioDirectorio,
} from './directorio.service';

const DIRECTORA: Identidad = {
  id: 'sub-dora',
  email: 'directora.jar0001@example.com',
  nombre: 'Dora',
  grupo: 'directora',
  idJardin: 'JAR-0001',
};

const usuario = (cambios: Partial<UsuarioDirectorio>): UsuarioDirectorio => ({
  usuario: 'sub-x',
  sub: 'sub-x',
  email: 'x@example.com',
  nombre: 'X',
  idJardin: 'JAR-0001',
  habilitado: true,
  estadoCognito: 'CONFIRMED',
  creadoEn: new Date('2026-10-16T10:00:00Z'),
  ...cambios,
});

function directorioFalso(cambios: Partial<Record<keyof DirectorioService, unknown>> = {}) {
  return {
    disponible: true,
    listar: jest.fn(async () => [
      { usuario: usuario({ usuario: 'sub-a', email: 'b@example.com' }), grupo: 'educadora' },
      {
        usuario: usuario({ usuario: 'sub-b', email: 'a@example.com', idJardin: 'JAR-0002' }),
        grupo: 'educadora',
      },
      { usuario: usuario({ usuario: 'sub-dora', email: 'd@example.com' }), grupo: 'directora' },
    ]),
    obtener: jest.fn(async (u: string) => usuario({ usuario: u, sub: u })),
    invitar: jest.fn(async (d: { email: string }) =>
      usuario({ usuario: 'sub-nueva', email: d.email, estadoCognito: 'FORCE_CHANGE_PASSWORD' }),
    ),
    reenviar: jest.fn(async () => undefined),
    habilitar: jest.fn(async () => undefined),
    gruposDe: jest.fn(async () => ['educadora']),
    asignarGrupo: jest.fn(async () => undefined),
    ...cambios,
  } as unknown as DirectorioService & Record<string, jest.Mock>;
}

describe('CuentasService', () => {
  it('lista solo las cuentas del jardín de la directora', async () => {
    const servicio = new CuentasService(directorioFalso());
    const cuentas = await servicio.listar(DIRECTORA);
    expect(cuentas.map((c) => c.usuario)).toEqual(['sub-a', 'sub-dora']);
    expect(cuentas[0]).toMatchObject({ grupo: 'educadora', estado: 'activa' });
  });

  it('invita con el jardín del token y queda pendiente', async () => {
    const directorio = directorioFalso();
    const cuenta = await new CuentasService(directorio).invitar(DIRECTORA, {
      email: 'Nueva.Tia@Example.com',
      nombre: 'Nueva Tía',
      grupo: 'educadora',
    });
    expect(directorio.invitar).toHaveBeenCalledWith({
      email: 'nueva.tia@example.com',
      nombre: 'Nueva Tía',
      grupo: 'educadora',
      idJardin: 'JAR-0001',
    });
    expect(cuenta).toMatchObject({ estado: 'pendiente', grupo: 'educadora' });
  });

  it('el cuerpo no puede traer el jardín', () => {
    const cuerpo = {
      email: 'x@example.com',
      nombre: 'X Y',
      grupo: 'educadora',
      idJardin: 'JAR-0002',
    };
    expect(InvitarCuentaRequestSchema.safeParse(cuerpo).success).toBe(false);
  });

  it('correo ya registrado: 409', async () => {
    const directorio = directorioFalso({
      invitar: jest.fn(async () => {
        throw new CorreoYaRegistrado();
      }),
    });
    await expect(
      new CuentasService(directorio).invitar(DIRECTORA, {
        email: 'x@example.com',
        nombre: 'X Y',
        grupo: 'educadora',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('invitación a medias (cuenta creada sin grupo)', () => {
    const DATOS = {
      email: 'Nueva.Tia@Example.com',
      nombre: 'Nueva Tía',
      grupo: 'educadora' as const,
    };
    const yaRegistrado = jest.fn(async () => {
      throw new CorreoYaRegistrado();
    });

    it('si falla la asignación del grupo, responde 503 y pide volver a invitar', async () => {
      const directorio = directorioFalso({
        invitar: jest.fn(async () => {
          throw new InvitacionIncompleta('TooManyRequestsException');
        }),
      });
      await expect(new CuentasService(directorio).invitar(DIRECTORA, DATOS)).rejects.toThrow(
        /Vuelve a invitar el mismo correo/,
      );
      await expect(new CuentasService(directorio).invitar(DIRECTORA, DATOS)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('al reinvitar asigna el grupo pedido y reenvía la contraseña temporal', async () => {
      const directorio = directorioFalso({
        invitar: yaRegistrado,
        obtener: jest.fn(async () =>
          usuario({ usuario: 'sub-huerfana', estadoCognito: 'FORCE_CHANGE_PASSWORD' }),
        ),
        gruposDe: jest.fn(async () => []),
      });
      const cuenta = await new CuentasService(directorio).invitar(DIRECTORA, DATOS);
      expect(directorio.obtener).toHaveBeenCalledWith('nueva.tia@example.com');
      expect(directorio.asignarGrupo).toHaveBeenCalledWith('sub-huerfana', 'educadora');
      expect(directorio.reenviar).toHaveBeenCalledWith('sub-huerfana');
      expect(cuenta).toMatchObject({
        usuario: 'sub-huerfana',
        grupo: 'educadora',
        estado: 'pendiente',
      });
    });

    it.each([
      ['de otro jardín', { idJardin: 'JAR-0002', estadoCognito: 'FORCE_CHANGE_PASSWORD' }, []],
      ['que ya cambió la contraseña', { estadoCognito: 'CONFIRMED' }, []],
      ['que ya tiene grupo', { estadoCognito: 'FORCE_CHANGE_PASSWORD' }, ['directora']],
    ])('una cuenta %s sigue siendo 409 y no se toca', async (_caso, cambios, grupos) => {
      const directorio = directorioFalso({
        invitar: yaRegistrado,
        obtener: jest.fn(async () => usuario(cambios as Partial<UsuarioDirectorio>)),
        gruposDe: jest.fn(async () => grupos),
      });
      await expect(new CuentasService(directorio).invitar(DIRECTORA, DATOS)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(directorio.asignarGrupo).not.toHaveBeenCalled();
      expect(directorio.reenviar).not.toHaveBeenCalled();
    });
  });

  it('no actúa sobre cuentas de otro jardín ni se desactiva a sí misma', async () => {
    const otroJardin = directorioFalso({
      obtener: jest.fn(async () => usuario({ idJardin: 'JAR-0002' })),
    });
    await expect(
      new CuentasService(otroJardin).habilitar(DIRECTORA, 'sub-x', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(otroJardin.habilitar).not.toHaveBeenCalled();

    const directorio = directorioFalso();
    await expect(
      new CuentasService(directorio).habilitar(DIRECTORA, 'sub-dora', false),
    ).rejects.toBeInstanceOf(BadRequestException);
    const cuenta = await new CuentasService(directorio).habilitar(DIRECTORA, 'sub-a', false);
    expect(directorio.habilitar).toHaveBeenCalledWith('sub-a', false);
    expect(cuenta.estado).toBe('desactivada');
  });

  it('reenvía solo invitaciones pendientes', async () => {
    const directorio = directorioFalso();
    await expect(
      new CuentasService(directorio).reenviar(DIRECTORA, 'sub-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    (directorio.obtener as jest.Mock).mockResolvedValueOnce(
      usuario({ estadoCognito: 'FORCE_CHANGE_PASSWORD' }),
    );
    await new CuentasService(directorio).reenviar(DIRECTORA, 'sub-x');
    expect(directorio.reenviar).toHaveBeenCalledWith('sub-x');
  });

  it('sin Cognito responde 501', async () => {
    const directorio = directorioFalso({ disponible: false });
    await expect(new CuentasService(directorio).listar(DIRECTORA)).rejects.toBeInstanceOf(
      NotImplementedException,
    );
  });
});
