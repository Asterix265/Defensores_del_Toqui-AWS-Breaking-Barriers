import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('acepta una respuesta válida', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      version: '0.0.0',
      timestamp: new Date().toISOString(),
      dependencies: { database: 'up' },
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un estado desconocido', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'roto',
      version: '0.0.0',
      timestamp: new Date().toISOString(),
      dependencies: { database: 'up' },
    });
    expect(result.success).toBe(false);
  });
});
