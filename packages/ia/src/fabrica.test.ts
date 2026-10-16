import { describe, expect, it } from 'vitest';
import { ErrorIa } from './errores.js';
import { crearProveedor } from './fabrica.js';
import {
  crearClienteSimulado,
  guardrailSinCambios,
  respuestaHerramienta,
} from './pruebas/bedrock-simulado.js';
import { contextoNivel7 } from './pruebas/catalogos.js';
import type { ConfigIa } from './proveedor.js';

const MODELO = 'modelo-de-prueba';
const NOTA = 'Apiló cuatro bloques solo y aplaudió cuando no se cayeron.';
const valida = () =>
  respuestaHerramienta({
    evidenciaInsuficiente: false,
    nivel: 7,
    manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
  });

function codigoDe(crear: () => unknown): string | undefined {
  try {
    crear();
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorIa);
    return (e as ErrorIa).codigo;
  }
  return undefined;
}

describe('crearProveedor', () => {
  it('crea el proveedor fake, que funciona sin credenciales ni red', async () => {
    const fake = crearProveedor({ proveedor: 'fake' });
    expect(fake.nombre).toBe('fake');
    const borrador = await fake.extraer('Nota breve.', contextoNivel7());
    expect(borrador.proveedor).toBe('fake');
  });

  it('rechaza bedrock sin Guardrail ni sinGuardrail', () => {
    expect(codigoDe(() => crearProveedor({ proveedor: 'bedrock', modelo: MODELO }))).toBe(
      'CONFIGURACION_INVALIDA',
    );
    expect(
      codigoDe(() => crearProveedor({ proveedor: 'bedrock', modelo: MODELO, sinGuardrail: false })),
    ).toBe('CONFIGURACION_INVALIDA');
  });

  it('con sinGuardrail: true crea bedrock sin aplicar Guardrail', async () => {
    const simulado = crearClienteSimulado({ converse: [valida()] });
    const bedrock = crearProveedor({
      proveedor: 'bedrock',
      modelo: MODELO,
      sinGuardrail: true,
      cliente: simulado.cliente,
    });
    expect(bedrock.nombre).toBe('bedrock');
    const borrador = await bedrock.extraer(NOTA, contextoNivel7());
    expect(borrador).toMatchObject({ proveedor: 'bedrock', modelo: MODELO });
    expect(simulado.comandosGuardrail()).toHaveLength(0);
    expect(simulado.comandosConverse()).toHaveLength(1);
  });

  it('con Guardrail usa el cliente inyectado y aplica el Guardrail', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [valida()],
    });
    const bedrock = crearProveedor({
      proveedor: 'bedrock',
      modelo: MODELO,
      guardrail: { id: 'guardrail-ficticio', version: '1' },
      cliente: simulado.cliente,
    });
    await bedrock.extraer(NOTA, contextoNivel7());
    expect(simulado.comandosGuardrail()).toHaveLength(1);
  });

  it('si vienen guardrail y sinGuardrail, aplica el Guardrail', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [valida()],
    });
    await crearProveedor({
      proveedor: 'bedrock',
      modelo: MODELO,
      guardrail: { id: 'guardrail-ficticio', version: '1' },
      sinGuardrail: true,
      cliente: simulado.cliente,
    }).extraer(NOTA, contextoNivel7());
    expect(simulado.comandosGuardrail()).toHaveLength(1);
  });

  it('crea su propio cliente si no se inyecta, sin llamar a AWS', () => {
    const bedrock = crearProveedor({
      proveedor: 'bedrock',
      modelo: MODELO,
      region: 'us-east-1',
      sinGuardrail: true,
    });
    expect(bedrock.nombre).toBe('bedrock');
  });

  it.each<[string, ConfigIa]>([
    ['modelo vacío', { proveedor: 'bedrock', modelo: '', sinGuardrail: true }],
    [
      'guardrail sin id',
      { proveedor: 'bedrock', modelo: MODELO, guardrail: { id: '', version: '1' } },
    ],
    [
      'guardrail sin versión',
      { proveedor: 'bedrock', modelo: MODELO, guardrail: { id: 'g', version: '' } },
    ],
    ['proveedor desconocido', { proveedor: 'otro' } as unknown as ConfigIa],
  ])('rechaza una configuración inválida: %s', (_caso, config) => {
    expect(codigoDe(() => crearProveedor(config))).toBe('CONFIGURACION_INVALIDA');
  });
});
