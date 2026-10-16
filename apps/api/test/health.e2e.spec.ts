import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthResponseSchema } from '@toqui/shared';
import { AppModule } from '../src/app.module';
import { AlmacenamientoService } from '../src/aws/almacenamiento.service';
import { ColaService } from '../src/aws/cola.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /health', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: jest.fn(), $disconnect: jest.fn() };
  const almacenamiento = { comprobarBucket: jest.fn() };
  const cola = { comprobar: jest.fn(), enviar: jest.fn() };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
    process.env['AUTH_MODE'] = 'local';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AlmacenamientoService)
      .useValue(almacenamiento)
      .overrideProvider(ColaService)
      .useValue(cola)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    almacenamiento.comprobarBucket.mockResolvedValue(undefined);
  });

  it('informa ok cuando la base y el bucket responden', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(HealthResponseSchema.parse(res.body)).toMatchObject({
      status: 'ok',
      dependencies: { database: 'up', storage: 'up', queue: 'up' },
    });
    expect(almacenamiento.comprobarBucket).toHaveBeenCalledWith(expect.any(AbortSignal));
    // En modo inline (por defecto) no hay cola que consultar.
    expect(cola.comprobar).not.toHaveBeenCalled();
  });

  it('informa degraded cuando la base no responde', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('sin conexión'));
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'degraded',
      dependencies: { database: 'down', storage: 'up' },
    });
  });

  it('informa degraded cuando la API no puede acceder al bucket', async () => {
    almacenamiento.comprobarBucket.mockRejectedValueOnce(
      Object.assign(new Error('UnknownError'), {
        name: 'Forbidden',
        $metadata: { httpStatusCode: 403 },
      }),
    );
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'degraded',
      dependencies: { database: 'up', storage: 'down' },
    });
  });

  it('informa down si el bucket no responde en 2 s', async () => {
    almacenamiento.comprobarBucket.mockReturnValueOnce(new Promise(() => undefined));
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'degraded', dependencies: { storage: 'down' } });
  });

  describe('en modo cola', () => {
    let appCola: INestApplication;

    beforeAll(async () => {
      process.env['PIPELINE_MODE'] = 'cola';
      process.env['SQS_URL_CAPTURAS'] = 'https://sqs.us-east-1.amazonaws.com/111111111111/toqui';
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .overrideProvider(AlmacenamientoService)
        .useValue(almacenamiento)
        .overrideProvider(ColaService)
        .useValue(cola)
        .compile();
      appCola = moduleRef.createNestApplication();
      await appCola.init();
    });

    afterAll(async () => {
      await appCola.close();
      delete process.env['PIPELINE_MODE'];
      delete process.env['SQS_URL_CAPTURAS'];
    });

    it('consulta la cola e informa ok si responde', async () => {
      cola.comprobar.mockResolvedValueOnce(undefined);
      const res = await request(appCola.getHttpServer()).get('/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', dependencies: { queue: 'up' } });
      expect(cola.comprobar).toHaveBeenCalledWith(expect.any(AbortSignal));
    });

    it('informa degraded si la API no puede consultar la cola', async () => {
      cola.comprobar.mockRejectedValueOnce(new Error('AccessDenied'));
      const res = await request(appCola.getHttpServer()).get('/health').expect(200);
      expect(res.body).toMatchObject({
        status: 'degraded',
        dependencies: { database: 'up', storage: 'up', queue: 'down' },
      });
    });
  });
});
