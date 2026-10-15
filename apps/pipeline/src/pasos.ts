import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ProveedorBedrock, ProveedorFake, type IaProvider } from '@toqui/ia';
import type { BorradorEntrante, ContextoCaptura, FormatoCaptura } from '@toqui/shared';
import type { PipelineEnv } from './config.js';

// Contrato entre los estados de la máquina `toqui-captura` (infra/lib/app-stack.ts).

export interface Ubicacion {
  bucket: string;
  clave: string;
}

/** Resultado de `preparar`, guardado en `$.preparado`. */
export interface Preparado {
  /** true si la captura ya tiene borrador o decisión: un evento repetido no la reprocesa. */
  omitir: boolean;
  formato: FormatoCaptura;
  /** Solo formato texto. */
  texto: string | null;
  contexto: Pick<ContextoCaptura, 'edadMeses' | 'nivelEsperado' | 'catalogo'>;
}

/** Fuente del texto a extraer, según el formato: escrito, lectura de foto o transcripción. */
export type Fuente = { texto: string } | { transcripcion: Ubicacion };

export interface EntradaExtraer {
  idCaptura: string;
  contexto: Preparado['contexto'];
  fuente: Fuente;
}

export interface EntradaEntregar {
  idCaptura: string;
  borrador: BorradorEntrante;
}

/** Error de un estado, tal como lo deja Step Functions en `$.error` (Catch). */
export interface EntradaError {
  idCaptura: string;
  error?: { Error?: string; Cause?: string };
}

export function proveedorIa(
  env: PipelineEnv,
): IaProvider & Partial<Pick<ProveedorBedrock, 'describirFoto'>> {
  if (env.IA_PROVIDER === 'fake') return new ProveedorFake();
  return new ProveedorBedrock({
    modelo: env.BEDROCK_MODEL_EXTRACCION,
    region: env.AWS_REGION,
    ...(env.BEDROCK_GUARDRAIL_ID &&
      env.BEDROCK_GUARDRAIL_VERSION && {
        guardrail: { id: env.BEDROCK_GUARDRAIL_ID, version: env.BEDROCK_GUARDRAIL_VERSION },
      }),
  });
}

let s3: S3Client | undefined;
export function clienteS3(region: string): S3Client {
  s3 ??= new S3Client({ region });
  return s3;
}

export async function leerObjeto(region: string, u: Ubicacion): Promise<Uint8Array> {
  const r = await clienteS3(region).send(new GetObjectCommand({ Bucket: u.bucket, Key: u.clave }));
  if (!r.Body) throw new Error(`s3://${u.bucket}/${u.clave} está vacío`);
  return r.Body.transformToByteArray();
}

/** Texto de un resultado de Amazon Transcribe (`results.transcripts[].transcript`). */
export function textoDeTranscripcion(json: string): string {
  const datos = JSON.parse(json) as { results?: { transcripts?: { transcript?: string }[] } };
  return (datos.results?.transcripts ?? [])
    .map((t) => t.transcript ?? '')
    .join(' ')
    .trim();
}
