import { loadEnv } from './env';

describe('loadEnv', () => {
  it('falla indicando la variable faltante', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('aplica valores por defecto', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db' });
    expect(env.PORT).toBe(3000);
    expect(env.AWS_REGION).toBe('us-east-1');
  });
});
