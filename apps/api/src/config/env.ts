import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    AWS_REGION: z.string().min(1).default('us-east-1'),
    /** `cognito` valida tokens del user pool; `dev` acepta `Bearer dev:<rol>:<sub>` (solo fuera de producción). */
    AUTH_MODO: z.enum(['cognito', 'dev']).default('cognito'),
    COGNITO_USER_POOL_ID: z.string().min(1).optional(),
    COGNITO_CLIENT_ID: z.string().min(1).optional(),
    /** Bucket privado de originales y audios de Polly. Sin él, las subidas responden 503. */
    S3_BUCKET: z.string().min(1).optional(),
    /** Endpoint alternativo (LocalStack, MinIO) para desarrollo. */
    S3_ENDPOINT: z.url().optional(),
    /** Cola de la Lambda de proceso. Sin ella, las observaciones quedan pendientes (solo desarrollo). */
    SQS_QUEUE_URL: z.url().optional(),
    SQS_ENDPOINT: z.url().optional(),
    ZONA_HORARIA: z.string().min(1).default('America/Santiago'),
    PESO_EJEMPLO_REGISTRADOR: z.coerce.number().positive().default(1),
    PESO_EJEMPLO_SUPERVISOR: z.coerce.number().positive().default(3),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODO === 'cognito' && (!env.COGNITO_USER_POOL_ID || !env.COGNITO_CLIENT_ID)) {
      ctx.addIssue({
        code: 'custom',
        path: ['COGNITO_USER_POOL_ID'],
        message: 'AUTH_MODO=cognito requiere COGNITO_USER_POOL_ID y COGNITO_CLIENT_ID',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (env.AUTH_MODO === 'dev') {
        ctx.addIssue({
          code: 'custom',
          path: ['AUTH_MODO'],
          message: 'dev no se permite en producción',
        });
      }
      for (const clave of ['S3_BUCKET', 'SQS_QUEUE_URL'] as const) {
        if (!env[clave])
          ctx.addIssue({ code: 'custom', path: [clave], message: 'obligatoria en producción' });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Valida las variables de entorno y termina con un mensaje claro si alguna falta o es inválida. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración inválida de la API:\n${detail}`);
  }
  return result.data;
}
