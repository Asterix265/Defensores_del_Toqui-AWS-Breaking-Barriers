import { BorradorEntranteSchema } from '@toqui/shared';
import { describe, expect, it } from 'vitest';
import {
  catalogoDataset,
  catalogoOchoPorDiez,
  contextoNivel7,
  filtrarNiveles,
} from './pruebas/catalogos.js';
import type { ContextoExtraccion, ResultadoValidacion } from './proveedor.js';
import { ubicarCita, validar } from './validacion.js';

const NOTA = 'Apiló cuatro bloques solo y aplaudió cuando no se cayeron.';

function problemas(resultado: ResultadoValidacion): string[] {
  if (resultado.ok) throw new Error('se esperaba una validación fallida');
  return resultado.problemas;
}

function propuesta(nivel: number, ...items: [string, string][]) {
  return {
    evidenciaInsuficiente: false,
    nivel,
    manifestaciones: items.map(([idManifestacion, cita]) => ({ idManifestacion, cita })),
  };
}

describe('ubicarCita', () => {
  it('devuelve la cita exacta si está en el texto', () => {
    expect(ubicarCita('Apiló cuatro bloques', NOTA)).toBe('Apiló cuatro bloques');
  });

  it('tolera mayúsculas y espacios repetidos y devuelve el fragmento del texto', () => {
    expect(ubicarCita('apiló cuatro  bloques', NOTA)).toBe('Apiló cuatro bloques');
  });

  it('tolera comillas y puntuación en los extremos', () => {
    expect(ubicarCita('«aplaudió cuando no se cayeron.»', NOTA)).toBe(
      'aplaudió cuando no se cayeron',
    );
    expect(ubicarCita('"Apiló cuatro bloques",', NOTA)).toBe('Apiló cuatro bloques');
  });

  it('respeta los saltos de línea del texto', () => {
    expect(ubicarCita('cuatro bloques', 'Apiló cuatro\nbloques.')).toBe('cuatro\nbloques');
  });

  it('trata como literales los caracteres especiales de expresiones regulares', () => {
    const texto = 'Dijo «¿más?» (tres veces) y señaló el vaso.';
    expect(ubicarCita('¿más?» (tres veces)', texto)).toBe('¿más?» (tres veces)');
    expect(ubicarCita('m.s', texto)).toBeNull();
  });

  it('devuelve null si la cita no está o queda vacía', () => {
    expect(ubicarCita('corrió por el patio', NOTA)).toBeNull();
    expect(ubicarCita('«».', NOTA)).toBeNull();
    expect(ubicarCita('', NOTA)).toBeNull();
  });
});

describe('validar', () => {
  const contexto = contextoNivel7();

  it('acepta una propuesta válida y devuelve un borrador del contrato', () => {
    const resultado = validar(
      propuesta(7, ['MAN-L07-MF-01', 'Apiló cuatro bloques']),
      NOTA,
      contexto,
    );
    expect(resultado).toEqual({
      ok: true,
      borrador: {
        textoFuente: NOTA,
        nivelSugerido: 7,
        evidenciaInsuficiente: false,
        manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
      },
    });
    if (resultado.ok) {
      expect(() =>
        BorradorEntranteSchema.parse({ ...resultado.borrador, proveedor: 'fake' }),
      ).not.toThrow();
    }
  });

  it('rechaza un id que no está en el catálogo y lo nombra', () => {
    const resultado = validar(
      propuesta(7, ['MAN-L99-XX-01', 'Apiló cuatro bloques']),
      NOTA,
      contexto,
    );
    expect(problemas(resultado).some((p) => p.includes('MAN-L99-XX-01'))).toBe(true);
  });

  it('rechaza niveles mezclados indicando el nivel de todas', () => {
    const resultado = validar(
      propuesta(7, ['MAN-L07-MF-01', 'Apiló cuatro bloques'], ['MAN-L08-MF-01', 'aplaudió']),
      NOTA,
      contexto,
    );
    const lista = problemas(resultado);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toContain('MAN-L08-MF-01');
    expect(lista[0]).toContain('nivel 7');
  });

  it('rechaza un nivel que no está entre los del catálogo', () => {
    const resultado = validar(
      propuesta(9, ['MAN-L07-MF-01', 'Apiló cuatro bloques']),
      NOTA,
      contexto,
    );
    expect(problemas(resultado)).toContain('el nivel 9 no está entre los del catálogo (6, 7, 8)');
  });

  it('rechaza una cita que no está en el texto y nombra la manifestación', () => {
    const resultado = validar(
      propuesta(7, ['MAN-L07-MF-01', 'Construyó una torre alta']),
      NOTA,
      contexto,
    );
    expect(problemas(resultado)).toEqual(['la cita de MAN-L07-MF-01 no está en el texto']);
  });

  it('acepta una cita con diferencias menores y devuelve el fragmento exacto', () => {
    const resultado = validar(
      propuesta(7, ['MAN-L07-MF-01', 'apiló cuatro  bloques']),
      NOTA,
      contexto,
    );
    expect(resultado.ok && resultado.borrador.manifestaciones[0]?.cita).toBe(
      'Apiló cuatro bloques',
    );
  });

  it('rechaza más de 5 manifestaciones', () => {
    const ids = contexto.catalogo.filter((m) => m.nivel === 7).slice(0, 6);
    expect(ids).toHaveLength(6);
    const resultado = validar(
      propuesta(7, ...ids.map((m): [string, string] => [m.id, 'Apiló'])),
      NOTA,
      contexto,
    );
    expect(problemas(resultado)).toEqual(['se proponen 6 manifestaciones; el máximo es 5']);
  });

  it('rechaza manifestaciones repetidas', () => {
    const resultado = validar(
      propuesta(7, ['MAN-L07-MF-01', 'Apiló'], ['MAN-L07-MF-01', 'bloques']),
      NOTA,
      contexto,
    );
    expect(problemas(resultado)).toEqual(['MAN-L07-MF-01 está repetida']);
  });

  it('rechaza una propuesta sin manifestaciones ni nivel', () => {
    const resultado = validar({ evidenciaInsuficiente: false }, NOTA, contexto);
    expect(problemas(resultado)).toEqual([
      'falta el nivel propuesto',
      'se debe proponer al menos 1 manifestación',
    ]);
  });

  it('con evidenciaInsuficiente ignora el nivel y las manifestaciones', () => {
    const resultado = validar(
      { ...propuesta(9, ['MAN-L99-XX-01', 'no está']), evidenciaInsuficiente: true },
      NOTA,
      contexto,
    );
    expect(resultado).toEqual({
      ok: true,
      borrador: {
        textoFuente: NOTA,
        nivelSugerido: null,
        evidenciaInsuficiente: true,
        manifestaciones: [],
      },
    });
  });

  it('rechaza un formato inválido con problemas en español', () => {
    const resultado = validar(
      { evidenciaInsuficiente: 'no', manifestaciones: [{ idManifestacion: '' }] },
      NOTA,
      contexto,
    );
    const lista = problemas(resultado);
    expect(lista.some((p) => p.startsWith('formato inválido en «evidenciaInsuficiente»'))).toBe(
      true,
    );
    expect(lista.some((p) => p.includes('«manifestaciones.0.cita»'))).toBe(true);
    expect(validar(null, NOTA, contexto).ok).toBe(false);
  });

  it('respeta un maxManifestaciones menor y nunca supera 5', () => {
    const dos = propuesta(7, ['MAN-L07-MF-01', 'Apiló'], ['MAN-L07-MF-02', 'bloques']);
    expect(problemas(validar(dos, NOTA, contexto, { maxManifestaciones: 1 }))).toEqual([
      'se proponen 2 manifestaciones; el máximo es 1',
    ]);
    const ids = contexto.catalogo.filter((m) => m.nivel === 7).slice(0, 6);
    const seis = propuesta(7, ...ids.map((m): [string, string] => [m.id, 'Apiló']));
    expect(problemas(validar(seis, NOTA, contexto, { maxManifestaciones: 10 }))).toEqual([
      'se proponen 6 manifestaciones; el máximo es 5',
    ]);
  });
});

describe('validar con rúbricas distintas', () => {
  const dataset: ContextoExtraccion = {
    edadMeses: 30,
    nivelEsperado: 5,
    catalogo: catalogoDataset(),
  };

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('ruta del dataset: acepta el nivel %i', (nivel) => {
    const id = `MAN-L0${nivel}-SE-01`;
    const resultado = validar(propuesta(nivel, [id, 'aplaudió']), NOTA, dataset);
    expect(resultado.ok && resultado.borrador.nivelSugerido).toBe(nivel);
  });

  it('ruta del dataset: los 5 dominios valen sin conocerlos de antemano', () => {
    const ids = dataset.catalogo.filter((m) => m.nivel === 4 && m.id.endsWith('-01'));
    expect(new Set(ids.map((m) => m.dominio)).size).toBe(5);
    const resultado = validar(
      propuesta(4, ...ids.map((m): [string, string] => [m.id, 'Apiló'])),
      NOTA,
      dataset,
    );
    expect(resultado.ok && resultado.borrador.manifestaciones).toHaveLength(5);
  });

  const ocho: ContextoExtraccion = {
    edadMeses: 20,
    nivelEsperado: 3,
    catalogo: catalogoOchoPorDiez(),
  };

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'rúbrica de 8 niveles y 10 núcleos: acepta el nivel %i',
    (nivel) => {
      const resultado = validar(propuesta(nivel, [`RUB-N${nivel}-10`, 'aplaudió']), NOTA, ocho);
      expect(resultado.ok).toBe(true);
    },
  );

  it('rúbrica de 8 niveles: rechaza el nivel 9, que no está en el catálogo', () => {
    const resultado = validar(propuesta(9, ['RUB-N8-01', 'aplaudió']), NOTA, ocho);
    expect(problemas(resultado)[0]).toBe(
      'el nivel 9 no está entre los del catálogo (1, 2, 3, 4, 5, 6, 7, 8)',
    );
  });

  it('catálogo con niveles 6, 7 y 8 rechaza el nivel 9 aunque exista en la ruta completa', () => {
    const recortado = { ...dataset, catalogo: filtrarNiveles(catalogoDataset(), [6, 7, 8]) };
    const resultado = validar(propuesta(9, ['MAN-L09-SE-01', 'aplaudió']), NOTA, recortado);
    expect(problemas(resultado)).toEqual([
      'el nivel 9 no está entre los del catálogo (6, 7, 8)',
      'MAN-L09-SE-01 no está en el catálogo',
    ]);
  });
});
