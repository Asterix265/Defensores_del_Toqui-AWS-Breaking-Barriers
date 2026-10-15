import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiInterna, ErrorApi, ErrorTransitorio } from './api.js';
import { loadEnv } from './config.js';
import { handler as extraer } from './handlers/extraer.js';
import { detalleDe, handler as informarError } from './handlers/informar-error.js';
import { handler as preparar } from './handlers/preparar.js';
import { textoDeTranscripcion } from './pasos.js';

const ID = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'token-de-prueba-del-pipeline';
const ENV = { API_URL: 'https://api.example.com/api', PIPELINE_TOKEN: TOKEN, IA_PROVIDER: 'fake' };
const catalogo = [
  { id: 'MAN-L07-MF-01', nivel: 7, dominio: 'motor_fino', textoObservable: 'Apila 4 bloques' },
];
const contexto = { edadMeses: 20, nivelEsperado: 7, catalogo };

function responder(estado: number, cuerpo: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: estado }));
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('configuración', () => {
  it('exige el secreto o el token del pipeline', () => {
    expect(() => loadEnv({ API_URL: ENV.API_URL })).toThrow(/PIPELINE_TOKEN_SECRET_ARN/);
  });
});

describe('ApiInterna', () => {
  it('envía el token del pipeline y valida la respuesta', async () => {
    const fetch = responder(200, { id: ID, estado: 'borrador_listo' });
    vi.stubGlobal('fetch', fetch);
    await expect(new ApiInterna(loadEnv()).informarError(ID, 'x')).resolves.toEqual({
      id: ID,
      estado: 'borrador_listo',
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/api/interno/capturas/${ID}/error`);
    expect(init.headers).toMatchObject({ 'x-pipeline-token': TOKEN });
  });

  it('5xx es transitorio (se reintenta) y 4xx no', async () => {
    vi.stubGlobal('fetch', responder(503, {}));
    await expect(new ApiInterna(loadEnv()).contexto(ID)).rejects.toBeInstanceOf(ErrorTransitorio);
    vi.stubGlobal('fetch', responder(404, {}));
    await expect(new ApiInterna(loadEnv()).contexto(ID)).rejects.toBeInstanceOf(ErrorApi);
  });
});

describe('handlers', () => {
  it('preparar omite una captura que ya tiene borrador', async () => {
    vi.stubGlobal(
      'fetch',
      responder(200, {
        id: ID,
        formato: 'texto',
        estado: 'borrador_listo',
        texto: 'Hola',
        ...contexto,
      }),
    );
    await expect(preparar({ idCaptura: ID })).resolves.toMatchObject({
      omitir: true,
      formato: 'texto',
      contexto: { nivelEsperado: 7 },
    });
  });

  it('extraer produce un borrador válido con el proveedor fake', async () => {
    const borrador = await extraer({
      idCaptura: ID,
      contexto,
      fuente: { texto: 'Apiló cuatro bloques solo y aplaudió. Luego siguió.' },
    });
    expect(borrador).toMatchObject({
      nivelSugerido: 7,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01' }],
      proveedor: 'fake',
    });
  });

  it('informar-error traduce el error y tolera capturas inexistentes', async () => {
    vi.stubGlobal('fetch', responder(404, {}));
    await expect(informarError({ idCaptura: ID })).resolves.toMatchObject({
      estado: 'inexistente',
    });
  });
});

describe('detalleDe', () => {
  it('muestra el motivo de una foto no válida y oculta los errores técnicos', () => {
    expect(
      detalleDe({
        Error: 'FotoNoValida',
        Cause: JSON.stringify({ errorMessage: 'La foto pesa 5 MB' }),
      }),
    ).toBe('La foto pesa 5 MB');
    expect(detalleDe({ Error: 'TypeError', Cause: '{"errorMessage":"x is undefined"}' })).toBe(
      'No se pudo procesar la nota',
    );
  });
});

describe('textoDeTranscripcion', () => {
  it('lee el texto del resultado de Transcribe', () => {
    const json = JSON.stringify({ results: { transcripts: [{ transcript: ' Apiló bloques. ' }] } });
    expect(textoDeTranscripcion(json)).toBe('Apiló bloques.');
  });
});
