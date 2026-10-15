import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HealthResponseSchema } from '@toqui/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /health', () => {
  let app: INestApplication;
  const prisma = { $queryRaw: jest.fn(), $disconnect: jest.fn() };

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
    process.env['AUTH_MODE'] = 'local';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('informa ok cuando la base responde', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(HealthResponseSchema.parse(res.body)).toMatchObject({
      status: 'ok',
      dependencies: { database: 'up' },
    });
  });

  it('informa degraded cuando la base no responde', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('sin conexión'));
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'degraded', dependencies: { database: 'down' } });
  });
});
