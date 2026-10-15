import { loadEnv } from './env';

const BASE = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('loadEnv', () => {
  it('falla indicando la variable faltante', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('aplica valores por defecto', () => {
    const env = loadEnv({ ...BASE, AUTH_MODO: 'dev' });
    expect(env.PORT).toBe(3000);
    expect(env.AWS_REGION).toBe('us-east-1');
    expect(env.ZONA_HORARIA).toBe('America/Santiago');
  });

  it('exige el user pool en modo cognito', () => {
    expect(() => loadEnv(BASE)).toThrow(/COGNITO_USER_POOL_ID/);
  });

  it('rechaza el modo dev y la falta de S3 o SQS en producción', () => {
    const error = (() => {
      try {
        loadEnv({ ...BASE, NODE_ENV: 'production', AUTH_MODO: 'dev' });
      } catch (e) {
        return (e as Error).message;
      }
      return '';
    })();
    expect(error).toMatch(/AUTH_MODO/);
    expect(error).toMatch(/S3_BUCKET/);
    expect(error).toMatch(/SQS_QUEUE_URL/);
  });
});
