import { z } from 'zod';

const EnvSchema = z
  .object({
    AWS_REGION: z.string().min(1).default('us-east-1'),
    /** Base de la API con el prefijo, p. ej. `https://dxxxx.cloudfront.net/api`. */
    API_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
    /** Nombre o ARN del secreto con `PIPELINE_TOKEN` (producción). */
    PIPELINE_TOKEN_SECRETO: z.string().min(1).optional(),
    /** Token directo: solo para pruebas locales. */
    PIPELINE_TOKEN: z.string().min(1).optional(),
    BUCKET_CAPTURAS: z.string().min(1),
    GUARDRAIL_ID: z.string().min(1),
    GUARDRAIL_VERSION: z.string().min(1),
    /** Proveedor de IA para clasificar y leer fotos. `bedrock` se agrega al integrar Claude. */
    IA_PROVIDER: z.enum(['fake']).default('fake'),
    /** Quién lee las fotos: Amazon Textract, o el lector de imagen de `IA_PROVIDER`. */
    LECTOR_FOTO: z.enum(['textract', 'ia']).default('textract'),
    TRANSCRIBE_IDIOMA: z.enum(['es-US', 'es-ES']).default('es-US'),
    /** Debe coincidir con `maxReceiveCount` de la cola (D4). */
    MAX_INTENTOS: z.coerce.number().int().min(1).default(3),
  })
  .refine((env) => env.PIPELINE_TOKEN_SECRETO ?? env.PIPELINE_TOKEN, {
    message: 'Falta PIPELINE_TOKEN_SECRETO (o PIPELINE_TOKEN en local)',
  });

export type PipelineEnv = z.infer<typeof EnvSchema>;

/** Valida las variables de entorno del pipeline y falla con un mensaje claro. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): PipelineEnv {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuración inválida del pipeline:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
