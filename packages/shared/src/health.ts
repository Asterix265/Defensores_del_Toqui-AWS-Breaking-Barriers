import { z } from 'zod';

/** Estado de una dependencia técnica de la API. */
export const DependencyStatusSchema = z.enum(['up', 'down']);

/** Respuesta de `GET /health`: estado de la API y de su base de datos. */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  timestamp: z.iso.datetime(),
  dependencies: z.object({
    database: DependencyStatusSchema,
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
