import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  AWS_REGION: z.string().min(1).default('us-east-1'),
  /** Ruta al bundle de CA de RDS; si existe, la conexión a Postgres usa TLS verificado. */
  DATABASE_SSL_CA: z.string().min(1).optional(),
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
