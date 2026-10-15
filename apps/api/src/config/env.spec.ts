import { loadEnv } from './env';

const BASE = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('loadEnv', () => {
  it('falla indicando la variable faltante', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('aplica valores por defecto', () => {
    const env = loadEnv({ ...BASE, AUTH_MODE: 'local' });
    expect(env.PORT).toBe(3000);
    expect(env.AWS_REGION).toBe('us-east-1');
    expect(env.PIPELINE_MODE).toBe('aws');
    expect(env.IA_PROVIDER).toBe('fake');
    expect(env.ZONA_HORARIA).toBe('America/Santiago');
  });

  it('trata las variables vacías como no definidas', () => {
    const env = loadEnv({ ...BASE, AUTH_MODE: 'local', S3_BUCKET_CAPTURAS: '', PORT: '' });
    expect(env.S3_BUCKET_CAPTURAS).toBeUndefined();
    expect(env.PORT).toBe(3000);
  });

  it('exige el User Pool en modo cognito', () => {
    expect(() => loadEnv(BASE)).toThrow(/COGNITO_USER_POOL_ID/);
  });

  it('rechaza AUTH_MODE=local en producción', () => {
    expect(() => loadEnv({ ...BASE, NODE_ENV: 'production', AUTH_MODE: 'local' })).toThrow(
      /AUTH_MODE=local solo se permite en desarrollo/,
    );
  });

  it('arranca en producción con la configuración que inyecta ToquiApp', () => {
    const env = loadEnv({
      ...BASE,
      NODE_ENV: 'production',
      COGNITO_USER_POOL_ID: 'us-east-1_x',
      COGNITO_CLIENT_ID: 'cliente',
      S3_BUCKET_CAPTURAS: 'toqui-prod-capturas-123',
    });
    expect(env).toMatchObject({ AUTH_MODE: 'cognito', PIPELINE_MODE: 'aws' });
  });
});
