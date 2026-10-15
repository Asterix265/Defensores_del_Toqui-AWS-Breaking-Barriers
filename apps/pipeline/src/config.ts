import { z } from 'zod';

const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), esquema.optional());

const EnvSchema = z
  .object({
    AWS_REGION: z.string().min(1).default('us-east-1'),
    /** Base de la API a través de CloudFront, p. ej. `https://xxxx.cloudfront.net/api`. */
    API_URL: z.url(),
    /** Secreto de Secrets Manager con el `PIPELINE_TOKEN` (en AWS). */
    PIPELINE_TOKEN_SECRET_ARN: opcional(z.string().min(1)),
    /** Token directo, para pruebas locales. */
    PIPELINE_TOKEN: opcional(z.string().min(16)),
    IA_PROVIDER: z.enum(['fake', 'bedrock']).default('bedrock'),
    BEDROCK_MODEL_EXTRACCION: z.string().min(1).default('us.anthropic.claude-sonnet-5-5'),
    BEDROCK_GUARDRAIL_ID: opcional(z.string().min(1)),
    BEDROCK_GUARDRAIL_VERSION: opcional(z.string().min(1)),
  })
  .refine((env) => env.PIPELINE_TOKEN_SECRET_ARN || env.PIPELINE_TOKEN, {
    path: ['PIPELINE_TOKEN_SECRET_ARN'],
    message: 'Se requiere PIPELINE_TOKEN_SECRET_ARN o PIPELINE_TOKEN',
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
