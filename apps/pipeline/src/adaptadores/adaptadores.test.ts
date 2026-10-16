import type { S3Client } from '@aws-sdk/client-s3';
import {
  ConflictException,
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  type TranscribeClient,
} from '@aws-sdk/client-transcribe';
import {
  DetectDocumentTextCommand,
  UnsupportedDocumentException,
  type TextractClient,
} from '@aws-sdk/client-textract';
import { describe, expect, it, vi } from 'vitest';
import { ErrorCapturaCerrada, ErrorPermanente } from '../errores.js';
import { ID_CAPTURA } from '../pruebas/datos.js';
import { ApiInternaHttp } from './api-interna.js';
import { LectorImagenTextract } from './textract.js';
import { TranscriptorAws } from './transcribe.js';

function s3ConTranscripcion(texto: string): S3Client {
  const json = JSON.stringify({ results: { transcripts: [{ transcript: texto }] } });
  return { send: vi.fn(async () => ({ Body: { transformToString: async () => json } })) } as never;
}

function transcribeCon(estados: string[], inicio?: Error): TranscribeClient {
  const send = vi.fn(async (comando: unknown) => {
    if (comando instanceof StartTranscriptionJobCommand) {
      if (inicio) throw inicio;
      return {};
    }
    if (comando instanceof GetTranscriptionJobCommand) {
      return { TranscriptionJob: { TranscriptionJobStatus: estados.shift() } };
    }
    throw new Error('comando inesperado');
  });
  return { send } as never;
}

const opciones = { bucket: 'capturas', idioma: 'es-US' as const, dormir: async () => undefined };
const entrada = {
  idCaptura: ID_CAPTURA,
  clave: `capturas/${ID_CAPTURA}.webm`,
  tipo: 'audio/webm' as const,
};

describe('TranscriptorAws', () => {
  it('inicia el trabajo, espera y lee el resultado', async () => {
    const transcribe = transcribeCon(['IN_PROGRESS', 'COMPLETED']);
    const t = new TranscriptorAws(transcribe, s3ConTranscripcion('Dijo agua.'), opciones);
    await expect(t.transcribir(entrada)).resolves.toBe('Dijo agua.');

    const inicio = vi.mocked(transcribe.send).mock.calls[0]![0] as StartTranscriptionJobCommand;
    expect(inicio.input).toMatchObject({
      TranscriptionJobName: `toqui-${ID_CAPTURA}`,
      MediaFormat: 'webm',
      Media: { MediaFileUri: `s3://capturas/capturas/${ID_CAPTURA}.webm` },
      OutputKey: `transcripciones/${ID_CAPTURA}.json`,
    });
  });

  it('en un reintento retoma el trabajo existente', async () => {
    const conflicto = new ConflictException({ message: 'existe', $metadata: {} });
    const t = new TranscriptorAws(
      transcribeCon(['COMPLETED'], conflicto),
      s3ConTranscripcion('Hola.'),
      opciones,
    );
    await expect(t.transcribir(entrada)).resolves.toBe('Hola.');
  });

  it('un trabajo fallido es un error permanente', async () => {
    const t = new TranscriptorAws(transcribeCon(['FAILED']), s3ConTranscripcion(''), opciones);
    await expect(t.transcribir(entrada)).rejects.toBeInstanceOf(ErrorPermanente);
  });

  it('si no termina a tiempo, el error es transitorio', async () => {
    const t = new TranscriptorAws(
      transcribeCon(['IN_PROGRESS', 'IN_PROGRESS']),
      s3ConTranscripcion(''),
      {
        ...opciones,
        esperaMaximaMs: 0,
      },
    );
    const error = await t.transcribir(entrada).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ErrorPermanente);
  });
});

describe('ApiInternaHttp', () => {
  function api(status: number, cuerpo: unknown = {}) {
    const fetch = vi.fn(async () => new Response(JSON.stringify(cuerpo), { status }));
    return {
      fetch,
      cliente: new ApiInternaHttp({
        url: 'https://api.test/api',
        token: async () => 'secreto',
        fetch,
      }),
    };
  }

  it('entrega con el token y devuelve el estado', async () => {
    const { fetch, cliente } = api(200, { id: ID_CAPTURA, estado: 'borrador_listo' });
    await expect(cliente.informarError(ID_CAPTURA, 'x'.repeat(600))).resolves.toBe(
      'borrador_listo',
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.test/api/interno/capturas/${ID_CAPTURA}/error`);
    expect(init.headers).toMatchObject({ 'x-pipeline-token': 'secreto' });
    expect(JSON.parse(init.body as string).detalle).toHaveLength(500);
  });

  it('clasifica las respuestas de error', async () => {
    await expect(api(409).cliente.informarError(ID_CAPTURA, 'x')).rejects.toBeInstanceOf(
      ErrorCapturaCerrada,
    );
    await expect(api(422).cliente.informarError(ID_CAPTURA, 'x')).rejects.toBeInstanceOf(
      ErrorPermanente,
    );
    const transitorio = await api(503)
      .cliente.informarError(ID_CAPTURA, 'x')
      .catch((e: unknown) => e);
    expect(transitorio).not.toBeInstanceOf(ErrorPermanente);
    expect(transitorio).not.toBeInstanceOf(ErrorCapturaCerrada);
  });
});

describe('LectorImagenTextract', () => {
  function textract(respuesta: () => Promise<unknown>): TextractClient {
    return { send: vi.fn(respuesta) } as never;
  }

  it('lee la foto desde S3 y une las líneas', async () => {
    const cliente = textract(async () => ({
      Blocks: [
        { BlockType: 'PAGE' },
        { BlockType: 'LINE', Text: 'Apiló 4 bloques ' },
        { BlockType: 'WORD', Text: 'Apiló' },
        { BlockType: 'LINE', Text: 'y aplaudió.' },
      ],
    }));
    const lector = new LectorImagenTextract(cliente, 'capturas');
    await expect(
      lector.leer({ idCaptura: ID_CAPTURA, clave: 'capturas/x.jpg', tipo: 'image/jpeg' }),
    ).resolves.toBe('Apiló 4 bloques y aplaudió.');

    const comando = vi.mocked(cliente.send).mock.calls[0]![0] as DetectDocumentTextCommand;
    expect(comando.input.Document).toEqual({
      S3Object: { Bucket: 'capturas', Name: 'capturas/x.jpg' },
    });
  });

  it('un documento no admitido es un error permanente', async () => {
    const lector = new LectorImagenTextract(
      textract(async () => {
        throw new UnsupportedDocumentException({ message: 'no', $metadata: {} });
      }),
      'capturas',
    );
    await expect(
      lector.leer({ idCaptura: ID_CAPTURA, clave: 'capturas/x.png', tipo: 'image/png' }),
    ).rejects.toBeInstanceOf(ErrorPermanente);
  });
});
