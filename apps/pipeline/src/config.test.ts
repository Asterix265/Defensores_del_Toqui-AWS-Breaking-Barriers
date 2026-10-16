import { describe, expect, it } from 'vitest';
import { loadEnv } from './config.js';

/** Variables obligatorias con valores ficticios. */
const BASE = {
  API_URL: 'https://api.ejemplo.test/api',
  BUCKET_CAPTURAS: 'capturas-ficticias',
  GUARDRAIL_ID: 'guardrail-ficticio',
  GUARDRAIL_VERSION: '1',
  PIPELINE_TOKEN: 'token-ficticio',
};

describe('loadEnv: proveedor de IA', () => {
  it('por defecto usa fake y el modelo de extracción', () => {
    const env = loadEnv({ ...BASE });
    expect(env.IA_PROVIDER).toBe('fake');
    expect(env.MODELO_EXTRACCION).toBe('us.anthropic.claude-sonnet-5');
    expect(env.LECTOR_FOTO).toBe('textract');
  });

  it('acepta bedrock con Textract y otro modelo', () => {
    const env = loadEnv({ ...BASE, IA_PROVIDER: 'bedrock', MODELO_EXTRACCION: 'modelo-prueba' });
    expect(env.IA_PROVIDER).toBe('bedrock');
    expect(env.MODELO_EXTRACCION).toBe('modelo-prueba');
    expect(env.LECTOR_FOTO).toBe('textract');
  });

  it('rechaza bedrock con LECTOR_FOTO=ia indicando usar textract', () => {
    expect(() => loadEnv({ ...BASE, IA_PROVIDER: 'bedrock', LECTOR_FOTO: 'ia' })).toThrow(
      'La lectura de fotos con IA no está disponible con bedrock: usa LECTOR_FOTO=textract',
    );
  });

  it('acepta fake con LECTOR_FOTO=ia', () => {
    const env = loadEnv({ ...BASE, IA_PROVIDER: 'fake', LECTOR_FOTO: 'ia' });
    expect(env.LECTOR_FOTO).toBe('ia');
  });

  it('rechaza un IA_PROVIDER desconocido', () => {
    expect(() => loadEnv({ ...BASE, IA_PROVIDER: 'openai' })).toThrow(/IA_PROVIDER/);
  });

  it('rechaza un MODELO_EXTRACCION vacío', () => {
    expect(() => loadEnv({ ...BASE, IA_PROVIDER: 'bedrock', MODELO_EXTRACCION: '' })).toThrow(
      /MODELO_EXTRACCION/,
    );
  });
});
