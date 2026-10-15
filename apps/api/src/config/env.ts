import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    AWS_REGION: z.string().min(1).default('us-east-1'),
    /** Ruta al bundle de CA de RDS; si existe, la conexión a Postgres usa TLS verificado. */
    DATABASE_SSL_CA: z.string().min(1).optional(),
    /**
     * `cognito` valida JWT del User Pool. `local` usa un usuario fijo (educadora de JAR-0001)
     * o `Bearer local:<educadora|directora>:<JAR-XXXX>`; se rechaza en producción.
     */
    AUTH_MODE: z.enum(['cognito', 'local']).default('cognito'),
    COGNITO_USER_POOL_ID: z.string().min(1).optional(),
    COGNITO_CLIENT_ID: z.string().min(1).optional(),
    /**
     * `aws`: el pipeline (Step Functions) se dispara al llegar el objeto a `capturas/` y
     * entrega el borrador por el endpoint interno. `inline`: los pasos corren en la API.
     */
    PIPELINE_MODE: z.enum(['aws', 'inline']).default('aws'),
    /**
     * Proveedor de IA del modo inline: `fake` (borradores deterministas, sin AWS) o `bedrock`
     * (Guardrail + Claude para el texto y la foto; el audio sigue con un texto de ejemplo).
     */
    IA_PROVIDER: z.enum(['fake', 'bedrock']).default('fake'),
    /** Modelo o inference profile de Claude para extraer y leer fotos. */
    BEDROCK_MODEL_EXTRACCION: z.string().min(1).default('us.anthropic.claude-sonnet-5-5'),
    /** Guardrail que anonimiza datos personales antes de enviar el texto a Claude. */
    BEDROCK_GUARDRAIL_ID: z.string().min(1).optional(),
    BEDROCK_GUARDRAIL_VERSION: z.string().min(1).optional(),
    /** Secreto compartido con el pipeline para el endpoint interno. Sin él, responde 503. */
    PIPELINE_TOKEN: z.string().min(16).optional(),
    /** Bucket privado de capturas. Sin él, las capturas de audio o foto responden 503. */
    S3_BUCKET_CAPTURAS: z.string().min(1).optional(),
    /** Endpoint alternativo (LocalStack, MinIO) para desarrollo. */
    S3_ENDPOINT: z.url().optional(),
    ZONA_HORARIA: z.string().min(1).default('America/Santiago'),
    /** Carpeta con los CSV del dataset E-1 (solo para la carga). */
    DATASET_DIR: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === 'cognito' && (!env.COGNITO_USER_POOL_ID || !env.COGNITO_CLIENT_ID)) {
      ctx.addIssue({
        code: 'custom',
        path: ['COGNITO_USER_POOL_ID'],
        message: 'AUTH_MODE=cognito requiere COGNITO_USER_POOL_ID y COGNITO_CLIENT_ID',
      });
    }
    if (env.BEDROCK_GUARDRAIL_ID && !env.BEDROCK_GUARDRAIL_VERSION) {
      ctx.addIssue({
        code: 'custom',
        path: ['BEDROCK_GUARDRAIL_VERSION'],
        message: 'BEDROCK_GUARDRAIL_ID requiere BEDROCK_GUARDRAIL_VERSION',
      });
    }
    if (env.NODE_ENV === 'production' && env.AUTH_MODE === 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message: 'AUTH_MODE=local solo se permite en desarrollo',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Valida las variables de entorno y termina con un mensaje claro si alguna falta o es inválida. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Una variable vacía (`S3_BUCKET_CAPTURAS=` en `.env.example`) cuenta como no definida.
  const definidas = Object.fromEntries(Object.entries(source).filter(([, valor]) => valor !== ''));
  const result = EnvSchema.safeParse(definidas);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida de la API:\n${detail}`);
  }
  return result.data;
}
