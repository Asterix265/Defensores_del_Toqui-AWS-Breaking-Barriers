import type { PrismaService } from '../prisma/prisma.service';
import type { Identidad } from './identidad';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  // Simula la tabla `usuarios` con la semántica de upsert de Prisma.
  const tabla = new Map<string, Identidad>();
  const upsert = jest.fn(
    async ({
      where,
      create,
      update,
    }: {
      where: { id: string };
      create: Pick<Identidad, 'id' | 'rol'> & Partial<Identidad>;
      update: Partial<Identidad>;
    }) => {
      const fila = tabla.has(where.id)
        ? { ...tabla.get(where.id)!, ...update }
        : { ...create, nombre: create.nombre ?? null, telefono: create.telefono ?? null };
      tabla.set(where.id, fila);
      return fila;
    },
  );
  const servicio = new UsuariosService({ usuario: { upsert } } as unknown as PrismaService);

  const deId: Identidad = {
    id: 'sub-1',
    rol: 'registrador',
    nombre: 'Ana Pérez',
    telefono: '+56911111111',
  };
  const deAcceso: Identidad = { ...deId, nombre: null, telefono: null };

  beforeEach(() => upsert.mockClear());

  it('un token de acceso no borra el nombre ni el teléfono, y no vuelve a escribir', async () => {
    await expect(servicio.sincronizar(deId)).resolves.toEqual(deId);
    await expect(servicio.sincronizar(deAcceso)).resolves.toEqual(deId);
    await expect(servicio.sincronizar(deId)).resolves.toEqual(deId);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('el primer acceso con token de acceso crea a la persona sin nombre', async () => {
    const nuevo = { ...deAcceso, id: 'sub-2' };
    await expect(servicio.sincronizar(nuevo)).resolves.toEqual(nuevo);
    expect(upsert.mock.calls[0]![0].update).toEqual({ rol: 'registrador' });
  });

  it('escribe de nuevo si cambia el rol o el nombre', async () => {
    await servicio.sincronizar({ ...deId, rol: 'supervisor' });
    await servicio.sincronizar({ ...deId, rol: 'supervisor', nombre: 'Ana P.' });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(tabla.get('sub-1')).toMatchObject({
      rol: 'supervisor',
      nombre: 'Ana P.',
      telefono: '+56911111111',
    });
  });
});
