import type { Env } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { EjemplosService } from './ejemplos.service';

const CONSULTA = {
  idJardin: 'JAR-0001',
  nivelEducativo: 'SC' as const,
  catalogo: new Set(['MAN-1', 'MAN-2']),
  excluir: '00000000-0000-4000-8000-000000000000',
};

function servicio(maximo: number, filas: unknown[] = []) {
  const findMany = jest.fn(async () => filas);
  const prisma = { correccion: { findMany } } as unknown as PrismaService;
  return { findMany, ejemplos: new EjemplosService({ EJEMPLOS_CORRECCIONES: maximo } as Env, prisma) };
}

const fila = (decision: string, nivel: number, ids: string[], texto = 'Apiló bloques.') => ({
  decision,
  final: { nivel, manifestaciones: ids.map((idManifestacion) => ({ idManifestacion, cita: null })) },
  captura: { borrador: { textoFuente: texto } },
});

describe('EjemplosService', () => {
  it('apagado con EJEMPLOS_CORRECCIONES=0: no consulta la base', async () => {
    const { findMany, ejemplos } = servicio(0);
    await expect(ejemplos.ejemplos(CONSULTA)).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filtra manifestaciones fuera del catálogo, recorta y respeta el máximo', async () => {
    const largo = 'a'.repeat(500);
    const { ejemplos } = servicio(2, [
      fila('corregida', 3, ['MAN-1', 'OTRA'], largo),
      fila('corregida', 4, ['OTRA']),
      fila('confirmada', 5, ['MAN-2']),
      fila('confirmada', 6, ['MAN-1']),
    ]);
    const resultado = await ejemplos.ejemplos(CONSULTA);
    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toMatchObject({ nivel: 3, idsManifestaciones: ['MAN-1'], corregida: true });
    expect(Array.from(resultado[0]!.textoFuente)).toHaveLength(400);
    expect(resultado[1]).toMatchObject({ nivel: 5, corregida: false });
  });
});
