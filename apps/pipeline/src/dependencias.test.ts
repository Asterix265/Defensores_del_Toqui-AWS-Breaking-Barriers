import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { TextractClient } from '@aws-sdk/client-textract';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { LectorImagenTextract } from './adaptadores/textract.js';
import { loadEnv, type PipelineEnv } from './config.js';
import { crearDependencias } from './dependencias.js';
import { ClasificadorBedrock } from './ia/bedrock.js';
import { ClasificadorFake, LectorImagenFake } from './ia/fake.js';

/** Variables obligatorias con valores ficticios. */
const BASE = {
  API_URL: 'https://api.ejemplo.test/api',
  BUCKET_CAPTURAS: 'capturas-ficticias',
  GUARDRAIL_ID: 'guardrail-ficticio',
  GUARDRAIL_VERSION: '1',
  PIPELINE_TOKEN: 'token-ficticio',
};

const silencio = () => undefined;

const CLIENTES = [
  BedrockRuntimeClient,
  S3Client,
  SecretsManagerClient,
  TextractClient,
  TranscribeClient,
];

let envios: MockInstance[] = [];

beforeEach(() => {
  // Si algún cliente de AWS enviara un comando al construirse, la prueba lo detecta sin red.
  envios = CLIENTES.map((Cliente) =>
    vi
      .spyOn(Cliente.prototype as unknown as { send: () => Promise<unknown> }, 'send')
      .mockRejectedValue(new Error('sin red en pruebas')),
  );
  for (const Cliente of CLIENTES) expect(vi.isMockFunction(Cliente.prototype.send)).toBe(true);
});

afterEach(() => {
  for (const envio of envios) expect(envio).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('crearDependencias: proveedor de IA', () => {
  it('con IA_PROVIDER=fake usa el ClasificadorFake', () => {
    const deps = crearDependencias(loadEnv({ ...BASE, IA_PROVIDER: 'fake' }), silencio);
    expect(deps.clasificador).toBeInstanceOf(ClasificadorFake);
    expect(deps.clasificador.proveedor).toBe('fake');
    expect(deps.lectorImagen).toBeInstanceOf(LectorImagenTextract);
  });

  it('con fake y LECTOR_FOTO=ia usa el lector de foto simulado', () => {
    const deps = crearDependencias(loadEnv({ ...BASE, LECTOR_FOTO: 'ia' }), silencio);
    expect(deps.lectorImagen).toBeInstanceOf(LectorImagenFake);
  });

  it('con bedrock usa ClasificadorBedrock con el modelo por defecto y lee fotos con Textract', () => {
    const deps = crearDependencias(loadEnv({ ...BASE, IA_PROVIDER: 'bedrock' }), silencio);
    expect(deps.clasificador).toBeInstanceOf(ClasificadorBedrock);
    expect(deps.clasificador.proveedor).toBe('bedrock');
    expect(deps.clasificador.modelo).toBe('us.anthropic.claude-sonnet-5');
    expect(deps.lectorImagen).toBeInstanceOf(LectorImagenTextract);
  });

  it('con bedrock usa MODELO_EXTRACCION y comparte el cliente de Bedrock con el Guardrail', () => {
    const deps = crearDependencias(
      loadEnv({ ...BASE, IA_PROVIDER: 'bedrock', MODELO_EXTRACCION: 'modelo-prueba' }),
      silencio,
    );
    expect(deps.clasificador.modelo).toBe('modelo-prueba');
    const delClasificador = (deps.clasificador as unknown as { cliente: unknown }).cliente;
    const delGuardrail = (deps.anonimizador as unknown as { bedrock: unknown }).bedrock;
    expect(delClasificador).toBeInstanceOf(BedrockRuntimeClient);
    expect(delClasificador).toBe(delGuardrail);
  });

  it('con un secreto del token tampoco llama a AWS al construirse', () => {
    const deps = crearDependencias(
      loadEnv({
        ...BASE,
        PIPELINE_TOKEN: undefined,
        PIPELINE_TOKEN_SECRETO: 'secreto-ficticio',
        IA_PROVIDER: 'bedrock',
      }),
      silencio,
    );
    expect(deps.clasificador).toBeInstanceOf(ClasificadorBedrock);
  });

  it('si llega bedrock con LECTOR_FOTO=ia sin pasar por loadEnv, falla con un error claro', () => {
    const env = { ...loadEnv({ ...BASE }), IA_PROVIDER: 'bedrock', LECTOR_FOTO: 'ia' };
    expect(() => crearDependencias(env as PipelineEnv, silencio)).toThrow(
      'LECTOR_FOTO=ia no está disponible con IA_PROVIDER=bedrock: usa LECTOR_FOTO=textract',
    );
  });
});
