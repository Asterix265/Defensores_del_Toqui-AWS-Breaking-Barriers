import { readdirSync, readFileSync } from 'node:fs';
import {
  BorradorEntranteSchema,
  DominioSchema,
  ManifestacionesResponseSchema,
  type Manifestacion,
} from '@toqui/shared';
import { describe, expect, it } from 'vitest';
import * as ia from './index.js';
import { crearProveedor, type ContextoExtraccion, type ManifestacionCatalogo } from './index.js';
import {
  crearClienteSimulado,
  guardrailSinCambios,
  respuestaHerramienta,
} from './pruebas/bedrock-simulado.js';
import { catalogoDataset, filtrarNiveles } from './pruebas/catalogos.js';

const NOTA = 'Apiló cuatro bloques solo y aplaudió cuando no se cayeron.';

/** Fuentes del módulo (sin pruebas ni fixtures). */
function fuentes(): [string, string][] {
  const carpeta = new URL('./', import.meta.url);
  return readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith('.ts') && !archivo.endsWith('.test.ts'))
    .map((archivo) => [archivo, readFileSync(new URL(archivo, carpeta), 'utf8')]);
}

describe('API pública de @toqui/ia', () => {
  it('exporta solo lo del contrato', () => {
    expect(Object.keys(ia).sort()).toEqual([
      'ErrorIa',
      'clasificarConClaude',
      'crearProveedor',
      'normalizarTexto',
      'textoDeTranscripcion',
      'validar',
    ]);
  });

  it('acepta el catálogo de la API (Manifestacion[]) sin conversión', async () => {
    const catalogo: Manifestacion[] = ManifestacionesResponseSchema.parse(
      filtrarNiveles(catalogoDataset(), [6, 7, 8]),
    );
    const comoModulo: ManifestacionCatalogo[] = catalogo;
    const contexto: ContextoExtraccion = { edadMeses: 30, nivelEsperado: 7, catalogo };
    expect(comoModulo).toBe(contexto.catalogo);
    const borrador = await crearProveedor({ proveedor: 'fake' }).extraer(NOTA, contexto);
    expect(() => BorradorEntranteSchema.parse(borrador)).not.toThrow();
  });

  it('se usa como desde una Lambda: crear, extraer y entregar sin conversiones', async () => {
    const contexto: ContextoExtraccion = {
      edadMeses: 30,
      nivelEsperado: 7,
      catalogo: filtrarNiveles(catalogoDataset(), [6, 7, 8]),
    };
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
        }),
      ],
    });
    const proveedores = [
      crearProveedor({ proveedor: 'fake' }),
      crearProveedor({
        proveedor: 'bedrock',
        modelo: 'modelo-de-prueba',
        guardrail: { id: 'guardrail-ficticio', version: '1' },
        cliente: simulado.cliente,
      }),
    ];
    for (const proveedor of proveedores) {
      const borrador = await proveedor.extraer(NOTA, contexto);
      expect(BorradorEntranteSchema.parse(borrador)).toEqual(borrador);
    }
  });
});

describe('Pureza del módulo', () => {
  it('solo depende de @toqui/shared, zod y el SDK de Bedrock', () => {
    const paquete = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(Object.keys(paquete.dependencies).sort()).toEqual([
      '@aws-sdk/client-bedrock-runtime',
      '@toqui/shared',
      'zod',
    ]);
  });

  it('el código no importa otra cosa ni lee process.env', () => {
    const permitidos = ['@aws-sdk/client-bedrock-runtime', '@toqui/shared', 'zod'];
    for (const [archivo, codigo] of fuentes()) {
      for (const [, especificador] of codigo.matchAll(/from '([^']+)'/g)) {
        if (especificador?.startsWith('./')) {
          expect(especificador, archivo).toMatch(/\.js$/);
        } else {
          expect(permitidos, `${archivo} importa ${especificador}`).toContain(especificador);
        }
      }
      expect(codigo, archivo).not.toContain('process.env');
    }
  });

  it('el código no conoce los dominios del dataset', () => {
    for (const [archivo, codigo] of fuentes()) {
      for (const dominio of DominioSchema.options) expect(codigo, archivo).not.toContain(dominio);
    }
  });
});
