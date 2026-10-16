import { z } from 'zod';

/** Estado de una dependencia técnica de la API. */
export const DependencyStatusSchema = z.enum(['up', 'down']);

/** Respuesta de `GET /health`: estado de la API, de su base de datos, del bucket y de la cola. */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  timestamp: z.iso.datetime(),
  dependencies: z.object({
    database: DependencyStatusSchema,
    /** `down` también si la API no tiene bucket configurado: audio y foto no funcionarían. */
    storage: DependencyStatusSchema,
    /** Cola de capturas (`PIPELINE_MODE=cola`); `up` en modo inline, donde no hay cola. */
    queue: DependencyStatusSchema,
  }),
});

export type DependencyStatus = z.infer<typeof DependencyStatusSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
