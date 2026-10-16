import { BorradorEntranteSchema } from '@toqui/shared';
import { describe, expect, it } from 'vitest';
import { ErrorIa } from './errores.js';
import { ProveedorFake } from './fake.js';
import { catalogoOchoPorDiez, contextoNivel7 } from './pruebas/catalogos.js';
import { TAMANO_MAXIMO_IMAGEN, type ContextoExtraccion, type FormatoImagen } from './proveedor.js';
import { validar } from './validacion.js';

const NOTA = 'Apiló cuatro bloques solo y aplaudió cuando no se cayeron';

/** Variante del catálogo con un texto que comparte 2 palabras con la nota (ver A1). */
function contextoBloques(): ContextoExtraccion {
  const contexto = contextoNivel7();
  return {
    ...contexto,
    catalogo: contexto.catalogo.map((m) =>
      m.id === 'MAN-L07-MF-01' ? { ...m, textoObservable: 'Apila cuatro bloques estables' } : m,
    ),
  };
}

const insuficiente = (textoFuente: string) => ({
  textoFuente,
  nivelSugerido: null,
  evidenciaInsuficiente: true,
  manifestaciones: [],
  proveedor: 'fake',
});

describe('ProveedorFake.extraer', () => {
  const fake = new ProveedorFake();

  it('propone MAN-L07-MF-01 para la nota de los bloques con una cita literal', async () => {
    const borrador = await fake.extraer(NOTA, contextoBloques());
    expect(borrador).toEqual({
      textoFuente: NOTA,
      nivelSugerido: 7,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: NOTA }],
      proveedor: 'fake',
    });
  });

  it('es determinista, sin modelo, y su resultado supera el contrato y validar', async () => {
    const contexto = contextoBloques();
    const primero = await fake.extraer(NOTA, contexto);
    const segundo = await fake.extraer(NOTA, contexto);
    expect(segundo).toEqual(primero);
    expect(primero.proveedor).toBe('fake');
    expect(primero).not.toHaveProperty('modelo');
    expect(() => BorradorEntranteSchema.parse(primero)).not.toThrow();
    const revalidado = validar(
      {
        evidenciaInsuficiente: primero.evidenciaInsuficiente,
        nivel: primero.nivelSugerido,
        manifestaciones: primero.manifestaciones,
      },
      primero.textoFuente,
      contexto,
    );
    expect(revalidado.ok).toBe(true);
  });

  it('con una sola palabra en común («bloques») ya propone la manifestación (mínimo 1)', async () => {
    const borrador = await fake.extraer(NOTA, contextoNivel7());
    expect(borrador).toMatchObject({
      nivelSugerido: 7,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: NOTA }],
      proveedor: 'fake',
    });
    expect(() => BorradorEntranteSchema.parse(borrador)).not.toThrow();
  });

  it('sin coincidencias suficientes queda con evidencia insuficiente', async () => {
    const nota = 'Durante la mañana miró por la ventana mientras llovía.';
    expect(await fake.extraer(nota, contextoBloques())).toEqual(insuficiente(nota));
  });

  it('una nota demasiado corta queda con evidencia insuficiente', async () => {
    expect(await fake.extraer('Asistió hoy.', contextoBloques())).toEqual(
      insuficiente('Asistió hoy.'),
    );
  });

  it('la lectura fija de una foto sin actividad queda con evidencia insuficiente', async () => {
    expect(await fake.extraer('Sin actividad observable.', contextoBloques())).toEqual(
      insuficiente('Sin actividad observable.'),
    );
  });

  it('solo considera las manifestaciones del nivel esperado', async () => {
    const contexto = contextoBloques();
    const borrador = await fake.extraer(NOTA, { ...contexto, nivelEsperado: 8 });
    expect(borrador.evidenciaInsuficiente).toBe(true);
  });

  it('propone una manifestación con núcleos que no conoce (8 niveles × 10 núcleos)', async () => {
    const nota = 'Ordenó piezas de colores según el tamaño de cada una.';
    const borrador = await fake.extraer(nota, {
      edadMeses: 20,
      nivelEsperado: 3,
      catalogo: catalogoOchoPorDiez(),
    });
    expect(borrador).toEqual({
      textoFuente: nota,
      nivelSugerido: 3,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'RUB-N3-05', cita: nota }],
      proveedor: 'fake',
    });
  });

  it('desempata por id', async () => {
    const texto = 'Apila cuatro bloques estables';
    const contexto: ContextoExtraccion = {
      edadMeses: 30,
      nivelEsperado: 2,
      catalogo: [
        { id: 'ZZ-02', nivel: 2, nucleo: 'nucleo_eco', textoObservable: texto },
        { id: 'ZZ-01', nivel: 2, nucleo: 'nucleo_faro', textoObservable: texto },
      ],
    };
    const borrador = await fake.extraer(NOTA, contexto);
    expect(borrador.manifestaciones[0]?.idManifestacion).toBe('ZZ-01');
  });

  it('normaliza la nota y cita la primera oración, de máximo 160 caracteres', async () => {
    const larga = `Apiló cuatro bloques ${'muy '.repeat(60)}alto.  Después aplaudió.`;
    const borrador = await fake.extraer(`  ${larga}\n`, contextoBloques());
    const cita = borrador.manifestaciones[0]?.cita ?? '';
    expect(borrador.textoFuente).toBe(larga.replace(/\s+/g, ' '));
    expect(cita.length).toBeLessThanOrEqual(160);
    expect(cita.startsWith('Apiló cuatro bloques')).toBe(true);
    expect(borrador.textoFuente.includes(cita)).toBe(true);
  });
});

describe('ProveedorFake.normalizarFoto', () => {
  const fake = new ProveedorFake();

  it('devuelve una lectura fija elegida por los bytes', async () => {
    const a = await fake.normalizarFoto(new Uint8Array([0]), 'jpeg');
    const b = await fake.normalizarFoto(new Uint8Array([1]), 'png');
    expect(a).not.toBe(b);
    expect(await fake.normalizarFoto(new Uint8Array([0]), 'png')).toBe(a);
  });

  it('rechaza una foto de 5 MB con un mensaje legible', async () => {
    const pesada = new Uint8Array(5 * 1024 * 1024);
    expect(pesada.byteLength).toBeGreaterThan(TAMANO_MAXIMO_IMAGEN);
    await expect(fake.normalizarFoto(pesada, 'jpeg')).rejects.toMatchObject({
      name: 'ErrorIa',
      codigo: 'FOTO_NO_VALIDA',
      message: expect.stringContaining('3,75 MB'),
    });
  });

  it('rechaza un formato distinto de JPEG o PNG', async () => {
    const error = await fake
      .normalizarFoto(new Uint8Array([1]), 'gif' as FormatoImagen)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorIa);
    expect((error as ErrorIa).codigo).toBe('FOTO_NO_VALIDA');
  });
});
