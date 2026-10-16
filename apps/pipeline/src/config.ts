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
    /**
     * Proveedor de IA para clasificar: `fake` (palabras clave, sin AWS) o `bedrock` (Claude en
     * Bedrock con `MODELO_EXTRACCION`).
     */
    IA_PROVIDER: z.enum(['fake', 'bedrock']).default('fake'),
    /** Modelo o perfil de inferencia de Claude para `IA_PROVIDER=bedrock`. */
    MODELO_EXTRACCION: z.string().min(1).default('us.anthropic.claude-opus-5'),
    /** Quién lee las fotos: Amazon Textract, o el lector de imagen de `IA_PROVIDER` (solo `fake`). */
    LECTOR_FOTO: z.enum(['textract', 'ia']).default('textract'),
    TRANSCRIBE_IDIOMA: z.enum(['es-US', 'es-ES']).default('es-US'),
    /** Debe coincidir con `maxReceiveCount` de la cola (D4). */
    MAX_INTENTOS: z.coerce.number().int().min(1).default(3),
  })
  .refine((env) => env.PIPELINE_TOKEN_SECRETO ?? env.PIPELINE_TOKEN, {
    message: 'Falta PIPELINE_TOKEN_SECRETO (o PIPELINE_TOKEN en local)',
  })
  .refine((env) => !(env.IA_PROVIDER === 'bedrock' && env.LECTOR_FOTO === 'ia'), {
    message: 'La lectura de fotos con IA no está disponible con bedrock: usa LECTOR_FOTO=textract',
    path: ['LECTOR_FOTO'],
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
