import { describe, expect, it } from 'vitest';
import { EcoOutputSchema, handler } from './eco.js';

describe('handler eco', () => {
  it('devuelve una respuesta válida según su esquema', async () => {
    const output = await handler({ idCaptura: 'CAP-0001' });
    expect(EcoOutputSchema.safeParse(output).success).toBe(true);
    expect(output.idCaptura).toBe('CAP-0001');
  });

  it('rechaza una entrada inválida', async () => {
    await expect(handler({})).rejects.toThrow();
  });
});
