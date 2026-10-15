import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TIPOS_ARCHIVO, type TipoArchivo } from '@toqui/shared';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Las URLs firmadas duran 5 minutos. */
export const DURACION_URL_SEGUNDOS = 300;

/** Prefijo que dispara el pipeline (regla de EventBridge de ToquiApp). */
export const PREFIJO_CAPTURAS = 'capturas/';

/** Clave de una captura: el pipeline obtiene el id de captura del nombre del archivo. */
export function claveCaptura(idCaptura: string, extension: string): string {
  return `${PREFIJO_CAPTURAS}${idCaptura}.${extension}`;
}

export interface UrlFirmada {
  url: string;
  expiraEn: string;
}

/** Acceso al bucket privado de capturas. Los archivos no pasan por la API: solo firma URLs. */
@Injectable()
export class AlmacenamientoService {
  private readonly s3: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.s3 = new S3Client({
      region: env.AWS_REGION,
      ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT, forcePathStyle: true }),
    });
  }

  /**
   * PUT firmado. El tipo y el tamaño entran en la firma: S3 rechaza la subida si el navegador
   * envía otro `Content-Type` u otro `Content-Length`.
   */
  async firmarSubida(idCaptura: string, tipo: TipoArchivo, tamano: number) {
    const clave = claveCaptura(idCaptura, TIPOS_ARCHIVO[tipo].extension);
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: clave,
        ContentType: tipo,
        ContentLength: tamano,
      }),
      {
        expiresIn: DURACION_URL_SEGUNDOS,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );
    return {
      clave,
      subida: {
        url,
        metodo: 'PUT' as const,
        cabeceras: { 'Content-Type': tipo },
        expiraEn: this.expiracion(),
      },
    };
  }

  /** Tipo y tamaño del objeto, o null si aún no existe en el bucket. */
  async inspeccionar(clave: string): Promise<{ tipo: string; bytes: number } | null> {
    try {
      const objeto = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket(), Key: clave }),
      );
      return { tipo: objeto.ContentType ?? '', bytes: objeto.ContentLength ?? 0 };
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  /** Guarda el texto escrito como objeto, para que el pipeline lo procese igual que un archivo. */
  async guardarTexto(idCaptura: string, texto: string): Promise<string> {
    const clave = claveCaptura(idCaptura, 'txt');
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: clave,
        Body: texto,
        ContentType: 'text/plain; charset=utf-8',
      }),
    );
    return clave;
  }

  async firmarLectura(clave: string): Promise<UrlFirmada> {
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket(), Key: clave }),
      { expiresIn: DURACION_URL_SEGUNDOS },
    );
    return { url, expiraEn: this.expiracion() };
  }

  private bucket(): string {
    if (!this.env.S3_BUCKET_CAPTURAS) {
      throw new ServiceUnavailableException('Almacenamiento de capturas no configurado');
    }
    return this.env.S3_BUCKET_CAPTURAS;
  }

  private expiracion(): string {
    return new Date(Date.now() + DURACION_URL_SEGUNDOS * 1000).toISOString();
  }
}
