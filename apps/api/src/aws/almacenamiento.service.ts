import { randomUUID } from 'node:crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, NotFound, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TIPOS_ARCHIVO, type TipoArchivo } from '@toqui/shared';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Las URLs firmadas duran 5 minutos (arquitectura v1). */
export const DURACION_URL_SEGUNDOS = 300;

export interface UrlFirmada {
  url: string;
  expiraEn: string;
}

/** Acceso al bucket privado. Solo firma URLs y consulta metadatos: los archivos no pasan por la API. */
@Injectable()
export class AlmacenamientoService {
  private readonly s3: S3Client;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.s3 = new S3Client({
      region: env.AWS_REGION,
      ...(env.S3_ENDPOINT && { endpoint: env.S3_ENDPOINT, forcePathStyle: true }),
    });
  }

  /** Carpeta exclusiva de cada persona; las subidas solo pueden escribir ahí. */
  carpetaDe(usuarioId: string): string {
    return `subidas/${usuarioId}/`;
  }

  /** POST firmado que S3 rechaza si cambia la clave, el tipo o se pasa del tamaño declarado. */
  async firmarSubida(usuarioId: string, tipo: TipoArchivo, tamano: number) {
    const bucket = this.bucket();
    const clave = `${this.carpetaDe(usuarioId)}${randomUUID()}.${TIPOS_ARCHIVO[tipo].extension}`;
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: bucket,
      Key: clave,
      Conditions: [
        ['eq', '$Content-Type', tipo],
        ['content-length-range', 1, tamano],
      ],
      Fields: { 'Content-Type': tipo },
      Expires: DURACION_URL_SEGUNDOS,
    });
    return { url, campos: fields, clave, expiraEn: this.expiracion() };
  }

  /** Tipo de contenido del objeto, o null si no existe (la app no terminó de subirlo). */
  async tipoDe(clave: string): Promise<string | null> {
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket(), Key: clave }));
      return head.ContentType ?? null;
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  async firmarLectura(clave: string): Promise<UrlFirmada> {
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket(), Key: clave }),
      {
        expiresIn: DURACION_URL_SEGUNDOS,
      },
    );
    return { url, expiraEn: this.expiracion() };
  }

  private bucket(): string {
    if (!this.env.S3_BUCKET) throw new ServiceUnavailableException('Almacenamiento no configurado');
    return this.env.S3_BUCKET;
  }

  private expiracion(): string {
    return new Date(Date.now() + DURACION_URL_SEGUNDOS * 1000).toISOString();
  }
}
