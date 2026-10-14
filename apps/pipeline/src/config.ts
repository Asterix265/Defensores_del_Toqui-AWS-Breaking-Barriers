import { z } from 'zod';

const EnvSchema = z.object({
  AWS_REGION: z.string().min(1).default('us-east-1'),
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
