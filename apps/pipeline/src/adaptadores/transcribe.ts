import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  ConflictException,
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  type LanguageCode,
  type MediaFormat,
  type TranscribeClient,
} from '@aws-sdk/client-transcribe';
import type { TipoArchivo } from '@toqui/shared';
import { z } from 'zod';
import { ErrorPermanente } from '../errores.js';
import type { Transcriptor } from '../puertos.js';

const FORMATOS: Partial<Record<TipoArchivo, MediaFormat>> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

const ResultadoTranscribeSchema = z.object({
  results: z.object({ transcripts: z.array(z.object({ transcript: z.string() })) }),
});

export interface OpcionesTranscribe {
  bucket: string;
  idioma: LanguageCode;
  /** D5: consulta cada 3 s durante un máximo de 90 s (la Lambda tiene 120 s). */
  intervaloMs?: number;
  esperaMaximaMs?: number;
  dormir?: (ms: number) => Promise<void>;
}

/**
 * Amazon Transcribe por lotes sobre el archivo ya subido. El trabajo se llama como la captura:
 * si la cola reintenta, se retoma el mismo trabajo en vez de crear otro.
 */
export class TranscriptorAws implements Transcriptor {
  private readonly intervaloMs: number;
  private readonly esperaMaximaMs: number;
  private readonly dormir: (ms: number) => Promise<void>;

  constructor(
    private readonly transcribe: TranscribeClient,
    private readonly s3: S3Client,
    private readonly opciones: OpcionesTranscribe,
  ) {
    this.intervaloMs = opciones.intervaloMs ?? 3_000;
    this.esperaMaximaMs = opciones.esperaMaximaMs ?? 90_000;
    this.dormir = opciones.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async transcribir({
    idCaptura,
    clave,
    tipo,
  }: {
    idCaptura: string;
    clave: string;
    tipo: TipoArchivo;
  }): Promise<string> {
    const formato = FORMATOS[tipo];
    if (!formato) throw new ErrorPermanente('Formato de audio no admitido');
    const nombre = `toqui-${idCaptura}`;
    const salida = `transcripciones/${idCaptura}.json`;
    const { bucket } = this.opciones;

    try {
      await this.transcribe.send(
        new StartTranscriptionJobCommand({
          TranscriptionJobName: nombre,
          LanguageCode: this.opciones.idioma,
          MediaFormat: formato,
          Media: { MediaFileUri: `s3://${bucket}/${clave}` },
          OutputBucketName: bucket,
          OutputKey: salida,
        }),
      );
    } catch (error) {
      // Reintento de la cola: el trabajo ya existe y se sigue esperando.
      if (!(error instanceof ConflictException)) throw error;
    }

    const limite = Date.now() + this.esperaMaximaMs;
    for (;;) {
      const { TranscriptionJob: trabajo } = await this.transcribe.send(
        new GetTranscriptionJobCommand({ TranscriptionJobName: nombre }),
      );
      const estado = trabajo?.TranscriptionJobStatus;
      if (estado === 'COMPLETED') break;
      if (estado === 'FAILED') throw new ErrorPermanente('No se pudo transcribir el audio');
      // Error transitorio: el trabajo sigue corriendo y el próximo intento lo retoma.
      if (Date.now() >= limite) throw new Error('La transcripción no terminó a tiempo');
      await this.dormir(this.intervaloMs);
    }

    const objeto = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: salida }));
    const json = JSON.parse((await objeto.Body?.transformToString()) ?? '{}') as unknown;
    const resultado = ResultadoTranscribeSchema.parse(json);
    return resultado.results.transcripts
      .map((t) => t.transcript)
      .join(' ')
      .trim();
  }
}
