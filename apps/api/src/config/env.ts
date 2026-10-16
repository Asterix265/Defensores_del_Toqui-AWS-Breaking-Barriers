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
     * `cola`: la API encola cada captura en SQS y la Lambda de proceso entrega el borrador por el
     * endpoint interno (producción). `inline`: los pasos corren en la API con `IA_PROVIDER` (local).
     */
    PIPELINE_MODE: z.enum(['cola', 'inline']).default('inline'),
    /** Cola de capturas (salida `ColaCapturasUrl` de ToquiApp). Obligatoria con `PIPELINE_MODE=cola`. */
    SQS_URL_CAPTURAS: z.url().optional(),
    /**
     * Decisiones previas del jardín que viajan como ejemplos en el mensaje de la cola (0 = apagado).
     * Ver panel-directora-y-aprendizaje, D4.
     */
    EJEMPLOS_CORRECCIONES: z.coerce.number().int().min(0).max(5).default(5),
    /** Proveedor de IA del modo inline. Por ahora solo `fake` (borradores deterministas). */
    IA_PROVIDER: z.enum(['fake']).default('fake'),
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
    if (env.PIPELINE_MODE === 'cola' && !env.SQS_URL_CAPTURAS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SQS_URL_CAPTURAS'],
        message: 'PIPELINE_MODE=cola requiere SQS_URL_CAPTURAS',
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
