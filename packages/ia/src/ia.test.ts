import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import type { Manifestacion } from '@toqui/shared';
import { describe, expect, it, vi } from 'vitest';
import { ProveedorBedrock } from './bedrock.js';
import { extraerFake } from './fake.js';
import { mensajeExtraccion } from './prompt.js';
import type { ContextoExtraccion } from './proveedor.js';
import { ubicarCita, validarPropuesta } from './validacion.js';

const catalogo: Manifestacion[] = [
  {
    id: 'MAN-L06-MF-01',
    nivel: 6,
    dominio: 'motor_fino',
    textoObservable: 'Toma objetos con pinza',
  },
  { id: 'MAN-L07-MF-01', nivel: 7, dominio: 'motor_fino', textoObservable: 'Apila 4 bloques' },
  {
    id: 'MAN-L07-LC-01',
    nivel: 7,
    dominio: 'lenguaje_comunicacion',
    textoObservable: 'Dice palabras',
  },
  { id: 'MAN-L08-MG-01', nivel: 8, dominio: 'motor_grueso', textoObservable: 'Corre' },
];
const contexto: ContextoExtraccion = { edadMeses: 20, nivelEsperado: 7, catalogo };
const NOTA = 'Apiló cuatro bloques solo y aplaudió. Después dijo "más" mirando a su compañero.';

describe('ubicarCita', () => {
  it('devuelve el fragmento literal aunque cambien mayúsculas, espacios o comillas', () => {
    expect(ubicarCita(NOTA, 'Apiló cuatro bloques solo')).toBe('Apiló cuatro bloques solo');
    expect(ubicarCita(NOTA, '«apiló  cuatro BLOQUES solo.»')).toBe('Apiló cuatro bloques solo');
  });

  it('null si la cita no está en el texto', () => {
    expect(ubicarCita(NOTA, 'apiló seis bloques')).toBeNull();
  });
});

describe('validarPropuesta', () => {
  it('acepta manifestaciones del catálogo, del mismo nivel y con cita literal', () => {
    const r = validarPropuesta(
      {
        evidenciaInsuficiente: false,
        nivel: 7,
        manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'apiló cuatro bloques solo' }],
      },
      NOTA,
      contexto,
    );
    expect(r).toEqual({
      ok: true,
      borrador: {
        textoFuente: NOTA,
        nivelSugerido: 7,
        evidenciaInsuficiente: false,
        manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques solo' }],
      },
    });
  });

  it('rechaza IDs inventados, niveles mezclados y citas ausentes', () => {
    const r = validarPropuesta(
      {
        evidenciaInsuficiente: false,
        nivel: 7,
        manifestaciones: [
          { idManifestacion: 'MAN-L99-XX-01', cita: 'Apiló' },
          { idManifestacion: 'MAN-L06-MF-01', cita: 'Apiló' },
          { idManifestacion: 'MAN-L07-LC-01', cita: 'cantó una canción' },
        ],
      },
      NOTA,
      contexto,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problemas).toEqual([
        'MAN-L99-XX-01 no está en el catálogo',
        'MAN-L06-MF-01 es del nivel 6, no del 7',
        'la cita de MAN-L07-LC-01 no aparece literalmente en la nota',
      ]);
    }
  });

  it('con evidencia insuficiente ignora lo demás', () => {
    const r = validarPropuesta({ evidenciaInsuficiente: true, nivel: 7 }, NOTA, contexto);
    expect(r).toMatchObject({ ok: true, borrador: { nivelSugerido: null, manifestaciones: [] } });
  });
});

describe('extraerFake', () => {
  it('propone una manifestación del nivel esperado aunque el catálogo traiga ±1', () => {
    expect(extraerFake(NOTA, contexto)).toMatchObject({
      nivelSugerido: 7,
      manifestaciones: [
        { idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques solo y aplaudió.' },
      ],
    });
  });
});

describe('mensajeExtraccion', () => {
  it('incluye la edad, el catálogo por nivel y la nota, sin otros datos', () => {
    const mensaje = mensajeExtraccion(NOTA, contexto);
    expect(mensaje).toContain('Edad: 20 meses. Nivel esperado para la edad: 7.');
    expect(mensaje).toContain('Nivel 6:\n- MAN-L06-MF-01 (motor_fino): Toma objetos con pinza');
    expect(mensaje).toContain(NOTA);
  });
});

/** Cliente de Bedrock simulado: responde en orden y guarda lo que recibe. */
function clienteSimulado(respuestas: unknown[]) {
  const send = vi.fn(async () => respuestas.shift());
  return { cliente: { send } as unknown as BedrockRuntimeClient, send };
}
const usoHerramienta = (input: unknown) => ({
  output: {
    message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't1', name: 'x', input } }] },
  },
});

describe('ProveedorBedrock', () => {
  it('anonimiza con el Guardrail y cita sobre el texto anonimizado', async () => {
    const anonimizado = 'Apiló cuatro bloques solo y aplaudió mirando a {NAME}.';
    const { cliente, send } = clienteSimulado([
      { action: 'GUARDRAIL_INTERVENED', outputs: [{ text: anonimizado }] },
      usoHerramienta({
        evidenciaInsuficiente: false,
        nivel: 7,
        manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques solo' }],
      }),
    ]);
    const ia = new ProveedorBedrock({ modelo: 'm', guardrail: { id: 'g', version: '1' }, cliente });
    const borrador = await ia.extraer(
      'Apiló cuatro bloques solo y aplaudió mirando a Tomás.',
      contexto,
    );
    expect(borrador).toMatchObject({
      textoFuente: anonimizado,
      nivelSugerido: 7,
      proveedor: 'bedrock',
    });
    const prompt = JSON.stringify(send.mock.calls[1]);
    expect(prompt).not.toContain('Tomás');
  });

  it('reintenta una vez con los problemas y luego deja evidencia insuficiente', async () => {
    const malo = usoHerramienta({
      evidenciaInsuficiente: false,
      nivel: 7,
      manifestaciones: [{ idManifestacion: 'MAN-L99-XX-01', cita: 'Apiló' }],
    });
    const { cliente, send } = clienteSimulado([malo, malo]);
    const ia = new ProveedorBedrock({ modelo: 'm', cliente });
    await expect(ia.extraer(NOTA, contexto)).resolves.toMatchObject({
      evidenciaInsuficiente: true,
      manifestaciones: [],
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(send.mock.calls[1])).toContain('MAN-L99-XX-01 no está en el catálogo');
  });

  it('no llama al modelo con una nota demasiado corta', async () => {
    const { cliente, send } = clienteSimulado([]);
    const ia = new ProveedorBedrock({ modelo: 'm', cliente });
    await expect(ia.extraer('Bien.', contexto)).resolves.toMatchObject({
      evidenciaInsuficiente: true,
    });
    expect(send).not.toHaveBeenCalled();
  });
});
