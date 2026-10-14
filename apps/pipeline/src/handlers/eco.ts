import { z } from 'zod';
import { loadEnv } from '../config.js';

/** Handler de ejemplo: valida su entrada y salida con zod. Se reemplaza por los pasos reales del pipeline. */
export const EcoInputSchema = z.object({ idCaptura: z.string().min(1) });
export const EcoOutputSchema = z.object({
  idCaptura: z.string(),
  region: z.string(),
  procesadoEn: z.iso.datetime(),
});

export type EcoOutput = z.infer<typeof EcoOutputSchema>;

export async function handler(event: unknown): Promise<EcoOutput> {
  const env = loadEnv();
  const input = EcoInputSchema.parse(event);
  return EcoOutputSchema.parse({
    idCaptura: input.idCaptura,
    region: env.AWS_REGION,
    procesadoEn: new Date().toISOString(),
  });
}
