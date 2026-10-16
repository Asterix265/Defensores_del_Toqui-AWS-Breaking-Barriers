import {
  BadDocumentException,
  DetectDocumentTextCommand,
  DocumentTooLargeException,
  InvalidS3ObjectException,
  UnsupportedDocumentException,
  type TextractClient,
} from '@aws-sdk/client-textract';
import { ErrorPermanente } from '../errores.js';
import type { LectorImagen } from '../puertos.js';

/**
 * Lectura de la foto con Amazon Textract (`DetectDocumentText`, síncrono), directo desde S3:
 * no descarga la imagen ni pasa por el modelo.
 *
 * Limitación conocida: Textract reconoce escritura a mano solo en inglés; en español solo texto
 * impreso. Con notas manuscritas en español hay que probar la calidad antes de la demo y, si no
 * alcanza, usar `LECTOR_FOTO=ia`.
 */
export class LectorImagenTextract implements LectorImagen {
  readonly proveedor = 'textract';

  constructor(
    private readonly textract: TextractClient,
    private readonly bucket: string,
  ) {}

  async leer({ clave }: Parameters<LectorImagen['leer']>[0]): Promise<string> {
    try {
      const { Blocks = [] } = await this.textract.send(
        new DetectDocumentTextCommand({
          Document: { S3Object: { Bucket: this.bucket, Name: clave } },
        }),
      );
      // Las líneas vienen en orden de lectura (los bloques WORD repetirían el texto). Se unen
      // con espacios: una frase cortada por el renglón del cuaderno debe poder citarse entera.
      return Blocks.filter((b) => b.BlockType === 'LINE' && b.Text)
        .map((b) => b.Text!.trim())
        .join(' ');
    } catch (error) {
      if (
        error instanceof BadDocumentException ||
        error instanceof UnsupportedDocumentException ||
        error instanceof DocumentTooLargeException
      ) {
        throw new ErrorPermanente('No se pudo leer la foto: formato o tamaño no admitido');
      }
      if (error instanceof InvalidS3ObjectException) {
        throw new ErrorPermanente('No se encontró el archivo subido');
      }
      // Throttling y fallos de red: transitorios, los reintenta la cola.
      throw error;
    }
  }
}
