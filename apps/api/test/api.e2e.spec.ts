// Pruebas de punta a punta contra PostgreSQL real (base aparte `toqui_test`, se recrea en cada corrida).
// S3 y SQS se reemplazan por dobles: la API solo firma URLs y encola.
import { execSync } from 'node:child_process';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AlmacenamientoService } from '../src/aws/almacenamiento.service';
import { ColaService } from '../src/aws/cola.service';
import { PrismaClient } from '../src/generated/prisma/client';
import { hoyEn } from '../src/observaciones/fechas';
import { PrismaService } from '../src/prisma/prisma.service';

const URL_ADMIN =
  process.env['TEST_DATABASE_ADMIN_URL'] ?? 'postgresql://toqui:toqui_local@localhost:5432/toqui';
const BASE_PRUEBA = 'toqui_test';
const URL_PRUEBA = URL_ADMIN.replace(/\/[^/?]+(\?|$)/, `/${BASE_PRUEBA}$1`);

const ANA = 'Bearer dev:registrador:ana';
const BETO = 'Bearer dev:registrador:beto';
const SUPER = 'Bearer dev:supervisor:sofia';

jest.setTimeout(60_000);

describe('API de observaciones (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const almacenamiento = {
    carpetaDe: (id: string) => `subidas/${id}/`,
    firmarSubida: jest.fn(),
    tipoDe: jest.fn(),
    firmarLectura: jest.fn(),
  };
  const cola = { encolar: jest.fn() };
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_ADMIN }) });
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${BASE_PRUEBA} WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${BASE_PRUEBA}`);
    await admin.$disconnect();
    execSync('pnpm exec prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: URL_PRUEBA },
      stdio: 'ignore',
    });

    process.env['DATABASE_URL'] = URL_PRUEBA;
    process.env['AUTH_MODO'] = 'dev';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AlmacenamientoService)
      .useValue(almacenamiento)
      .overrideProvider(ColaService)
      .useValue(cola)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.criterio.createMany({
      data: [
        { id: 'socioemocional', nombre: 'Socioemocional', orden: 2 },
        { id: 'lenguaje', nombre: 'Lenguaje', orden: 1 },
        { id: 'motor', nombre: 'Motor', orden: 3 },
        { id: 'retirado', nombre: 'Retirado', orden: 4, activo: false },
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    almacenamiento.firmarLectura.mockImplementation(async (clave: string) => ({
      url: `https://s3.example.com/${clave}?firma=1`,
      expiraEn: new Date().toISOString(),
    }));
  });

  /** Simula a la Lambda de proceso dejando una propuesta. */
  async function proponer(id: string, criterioId = 'lenguaje', opciones: string[] = []) {
    await prisma.observacion.update({
      where: { id },
      data: {
        estado: 'propuesta',
        criterioPropuestoId: criterioId,
        criterioId,
        confianza: opciones.length ? 0.55 : 0.92,
        opciones,
        audioPropuestaClave: `polly/${id}.mp3`,
      },
    });
  }

  async function crearTexto(token = ANA, texto = 'Juega con bloques y nombra colores') {
    const res = await http()
      .post('/observaciones')
      .set('Authorization', token)
      .send({ tipo: 'texto', texto });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  describe('autenticación y roles', () => {
    it('exige token, salvo en /health', async () => {
      await http().get('/me').expect(401);
      await http().get('/me').set('Authorization', 'Bearer cualquiera').expect(401);
      await http().get('/health').expect(200);
    });

    it('GET /me devuelve el rol del token y registra a la persona', async () => {
      const res = await http().get('/me').set('Authorization', ANA).expect(200);
      expect(res.body).toEqual({ id: 'ana', rol: 'registrador', nombre: 'ana', telefono: null });
      await expect(prisma.usuario.findUnique({ where: { id: 'ana' } })).resolves.toMatchObject({
        rol: 'registrador',
      });
    });

    it('un registrador recibe 403 en el panel y en validación', async () => {
      await http().get('/panel/observaciones').set('Authorization', ANA).expect(403);
      await http().get('/panel/resumen').set('Authorization', ANA).expect(403);
      const id = await crearTexto();
      await http()
        .post(`/observaciones/${id}/validacion`)
        .set('Authorization', ANA)
        .send({ criterioId: 'lenguaje' })
        .expect(403);
    });

    it('un supervisor no registra observaciones', async () => {
      await http()
        .post('/observaciones')
        .set('Authorization', SUPER)
        .send({ tipo: 'texto', texto: 'x' })
        .expect(403);
      await http()
        .post('/subidas')
        .set('Authorization', SUPER)
        .send({ tipo: 'audio/webm', tamano: 10 })
        .expect(403);
    });
  });

  it('GET /criterios lista solo los activos, en orden', async () => {
    const res = await http().get('/criterios').set('Authorization', ANA).expect(200);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([
      'lenguaje',
      'socioemocional',
      'motor',
    ]);
  });

  describe('POST /subidas', () => {
    it('firma la subida en la carpeta de la persona', async () => {
      almacenamiento.firmarSubida.mockResolvedValue({
        url: 'https://bucket.s3.amazonaws.com/',
        campos: { key: 'subidas/ana/x.webm' },
        clave: 'subidas/ana/x.webm',
        expiraEn: new Date().toISOString(),
      });
      await http()
        .post('/subidas')
        .set('Authorization', ANA)
        .send({ tipo: 'audio/webm', tamano: 200_000 })
        .expect(201);
      expect(almacenamiento.firmarSubida).toHaveBeenCalledWith('ana', 'audio/webm', 200_000);
    });

    it('rechaza tipos no admitidos y archivos de más de 10 MB', async () => {
      await http()
        .post('/subidas')
        .set('Authorization', ANA)
        .send({ tipo: 'video/mp4', tamano: 10 })
        .expect(400);
      await http()
        .post('/subidas')
        .set('Authorization', ANA)
        .send({ tipo: 'image/jpeg', tamano: 11 * 1024 * 1024 })
        .expect(400);
    });
  });

  describe('POST /observaciones', () => {
    it('crea un texto como pendiente, con la fecha de Chile, y lo encola', async () => {
      const id = await crearTexto();
      expect(cola.encolar).toHaveBeenCalledWith({ idObservacion: id });
      const fila = await prisma.observacion.findUniqueOrThrow({ where: { id } });
      expect(fila).toMatchObject({ estado: 'pendiente', usuarioId: 'ana', tipo: 'texto' });
      expect(fila.fecha.toISOString().slice(0, 10)).toBe(hoyEn('America/Santiago'));
    });

    it('valida que el cuerpo corresponda al tipo', async () => {
      await http()
        .post('/observaciones')
        .set('Authorization', ANA)
        .send({ tipo: 'texto' })
        .expect(400);
      await http()
        .post('/observaciones')
        .set('Authorization', ANA)
        .send({ tipo: 'audio', texto: 'hola' })
        .expect(400);
    });

    it('acepta un audio ya subido a la carpeta propia', async () => {
      almacenamiento.tipoDe.mockResolvedValue('audio/webm');
      const res = await http()
        .post('/observaciones')
        .set('Authorization', ANA)
        .send({ tipo: 'audio', clave: 'subidas/ana/a.webm' })
        .expect(201);
      await expect(
        prisma.observacion.findUnique({ where: { id: res.body.id } }),
      ).resolves.toMatchObject({
        archivoClave: 'subidas/ana/a.webm',
        archivoTipo: 'audio/webm',
      });
    });

    it('rechaza archivos ajenos, no subidos o de otro tipo', async () => {
      const enviar = (clave: string, tipo = 'audio') =>
        http().post('/observaciones').set('Authorization', ANA).send({ tipo, clave });
      await enviar('subidas/beto/a.webm').expect(422);
      await enviar('subidas/ana/../beto/a.webm').expect(422);
      almacenamiento.tipoDe.mockResolvedValueOnce(null);
      await enviar('subidas/ana/falta.webm').expect(422);
      almacenamiento.tipoDe.mockResolvedValueOnce('image/png');
      await enviar('subidas/ana/foto.png', 'audio').expect(422);
      expect(cola.encolar).not.toHaveBeenCalled();
    });

    it('si SQS falla responde 503 y deja la observación en error', async () => {
      cola.encolar.mockRejectedValueOnce(new Error('SQS caído'));
      await http()
        .post('/observaciones')
        .set('Authorization', BETO)
        .send({ tipo: 'texto', texto: 'falla la cola' })
        .expect(503);
      await expect(
        prisma.observacion.findFirst({ where: { usuarioId: 'beto', texto: 'falla la cola' } }),
      ).resolves.toMatchObject({ estado: 'error' });
    });
  });

  describe('GET /observaciones/:id', () => {
    it('sin propuesta mientras está pendiente', async () => {
      const id = await crearTexto();
      const res = await http().get(`/observaciones/${id}`).set('Authorization', ANA).expect(200);
      expect(res.body).toMatchObject({ id, estado: 'pendiente', propuesta: null, criterio: null });
    });

    it('con propuesta, opciones y audio de Polly cuando llega', async () => {
      const id = await crearTexto();
      await proponer(id, 'lenguaje', ['lenguaje', 'socioemocional']);
      const res = await http().get(`/observaciones/${id}`).set('Authorization', ANA).expect(200);
      expect(res.body.propuesta).toEqual({
        criterio: { id: 'lenguaje', nombre: 'Lenguaje' },
        confianza: 0.55,
        opciones: [
          { id: 'lenguaje', nombre: 'Lenguaje' },
          { id: 'socioemocional', nombre: 'Socioemocional' },
        ],
        audioUrl: `https://s3.example.com/polly/${id}.mp3?firma=1`,
      });
    });

    it('404 para la observación de otra persona o un id inválido; el supervisor ve todas', async () => {
      const id = await crearTexto();
      await http().get(`/observaciones/${id}`).set('Authorization', BETO).expect(404);
      await http().get('/observaciones/no-es-uuid').set('Authorization', ANA).expect(404);
      await http().get(`/observaciones/${id}`).set('Authorization', SUPER).expect(200);
    });
  });

  describe('revisión y validación', () => {
    it('confirmar y luego corregir: historial completo y un solo ejemplo del registrador', async () => {
      const id = await crearTexto();
      await proponer(id, 'lenguaje');

      const confirmada = await http()
        .post(`/observaciones/${id}/revision`)
        .set('Authorization', ANA)
        .send({ criterioId: 'lenguaje' })
        .expect(200);
      expect(confirmada.body).toMatchObject({ estado: 'confirmada', criterio: { id: 'lenguaje' } });

      const corregida = await http()
        .post(`/observaciones/${id}/revision`)
        .set('Authorization', ANA)
        .send({ criterioId: 'motor' })
        .expect(200);
      expect(corregida.body).toMatchObject({
        estado: 'corregida',
        criterio: { id: 'motor' },
        propuesta: { criterio: { id: 'lenguaje' } },
      });

      const revisiones = await prisma.revision.findMany({
        where: { observacionId: id },
        orderBy: { creadoEn: 'asc' },
      });
      expect(revisiones.map((r) => [r.criterioId, r.coincideConPropuesta])).toEqual([
        ['lenguaje', true],
        ['motor', false],
      ]);
      const ejemplos = await prisma.ejemplo.findMany({ where: { observacionId: id } });
      expect(ejemplos).toEqual([
        expect.objectContaining({ origen: 'registrador', criterioId: 'motor', peso: 1 }),
      ]);
    });

    it('409 sin propuesta, 422 con criterio inexistente o inactivo, 404 si es ajena', async () => {
      const id = await crearTexto();
      const revisar = (token: string, criterioId: string) =>
        http()
          .post(`/observaciones/${id}/revision`)
          .set('Authorization', token)
          .send({ criterioId });
      await revisar(ANA, 'lenguaje').expect(409);
      await proponer(id);
      await revisar(ANA, 'no-existe').expect(422);
      await revisar(ANA, 'retirado').expect(422);
      await revisar(BETO, 'lenguaje').expect(404);
    });

    it('validada por el supervisor queda cerrada para el registrador (409)', async () => {
      const id = await crearTexto();
      await proponer(id, 'lenguaje');

      const validada = await http()
        .post(`/observaciones/${id}/validacion`)
        .set('Authorization', SUPER)
        .send({ criterioId: 'socioemocional' })
        .expect(200);
      expect(validada.body).toMatchObject({
        estado: 'validada',
        criterio: { id: 'socioemocional' },
      });
      expect(validada.body.validadoEn).toEqual(expect.any(String));

      await http()
        .post(`/observaciones/${id}/revision`)
        .set('Authorization', ANA)
        .send({ criterioId: 'lenguaje' })
        .expect(409);

      await expect(
        prisma.ejemplo.findUnique({
          where: { observacionId_origen: { observacionId: id, origen: 'supervisor' } },
        }),
      ).resolves.toMatchObject({ criterioId: 'socioemocional', peso: 3, usuarioId: 'sofia' });

      // El supervisor sí puede volver a cambiarla.
      await http()
        .post(`/observaciones/${id}/validacion`)
        .set('Authorization', SUPER)
        .send({ criterioId: 'motor' })
        .expect(200);
    });
  });

  describe('GET /observaciones/:id/archivo', () => {
    it('el dueño y el supervisor obtienen la URL; otros reciben 404', async () => {
      almacenamiento.tipoDe.mockResolvedValue('image/jpeg');
      const { body } = await http()
        .post('/observaciones')
        .set('Authorization', ANA)
        .send({ tipo: 'foto', clave: 'subidas/ana/f.jpg' })
        .expect(201);

      const res = await http()
        .get(`/observaciones/${body.id}/archivo`)
        .set('Authorization', ANA)
        .expect(200);
      expect(res.body).toMatchObject({
        url: 'https://s3.example.com/subidas/ana/f.jpg?firma=1',
        tipo: 'image/jpeg',
      });
      await http().get(`/observaciones/${body.id}/archivo`).set('Authorization', SUPER).expect(200);
      await http().get(`/observaciones/${body.id}/archivo`).set('Authorization', BETO).expect(404);
    });

    it('404 si la observación es de texto', async () => {
      const id = await crearTexto();
      await http().get(`/observaciones/${id}/archivo`).set('Authorization', ANA).expect(404);
    });
  });

  describe('Mi día y panel', () => {
    let idsCarla: string[];

    beforeAll(async () => {
      const CARLA = 'Bearer dev:registrador:carla';
      idsCarla = [
        await crearTexto(CARLA, 'uno'),
        await crearTexto(CARLA, 'dos'),
        await crearTexto(CARLA, 'tres'),
      ];
      await proponer(idsCarla[0]!, 'motor');
      await proponer(idsCarla[1]!, 'motor');
      // Una de ayer, que no debe aparecer en el día.
      await prisma.observacion.update({
        where: { id: idsCarla[2]! },
        data: { fecha: new Date('2020-01-01') },
      });
    });

    it('GET /mi-dia devuelve solo lo propio del día', async () => {
      const res = await http()
        .get('/mi-dia')
        .set('Authorization', 'Bearer dev:registrador:carla')
        .expect(200);
      expect(res.body.fecha).toBe(hoyEn('America/Santiago'));
      expect(res.body.observaciones.map((o: { id: string }) => o.id).sort()).toEqual(
        idsCarla.slice(0, 2).sort(),
      );
      expect(res.body.observaciones[0]).toMatchObject({
        estado: 'propuesta',
        usuario: { id: 'carla' },
      });

      const antes = await http()
        .get('/mi-dia?fecha=2020-01-01')
        .set('Authorization', 'Bearer dev:registrador:carla');
      expect(antes.body.observaciones.map((o: { id: string }) => o.id)).toEqual([idsCarla[2]]);
      await http().get('/mi-dia?fecha=ayer').set('Authorization', ANA).expect(400);
    });

    it('GET /panel/observaciones filtra y pagina', async () => {
      const res = await http()
        .get('/panel/observaciones?usuarioId=carla&criterioId=motor&pagina=1&tamano=1')
        .set('Authorization', SUPER)
        .expect(200);
      expect(res.body).toMatchObject({ total: 2, pagina: 1, tamano: 1 });
      expect(res.body.items).toHaveLength(1);

      const pendientes = await http()
        .get(`/panel/observaciones?estado=pendiente&fecha=2020-01-01`)
        .set('Authorization', SUPER)
        .expect(200);
      expect(pendientes.body.items.map((o: { id: string }) => o.id)).toEqual([idsCarla[2]]);
      await http().get('/panel/observaciones?tamano=500').set('Authorization', SUPER).expect(400);
    });

    it('GET /panel/resumen cuenta por criterio, estado y persona', async () => {
      const res = await http().get('/panel/resumen').set('Authorization', SUPER).expect(200);
      const total = await prisma.observacion.count({
        where: { fecha: new Date(`${res.body.fecha}T00:00:00Z`) },
      });
      expect(res.body.total).toBe(total);
      expect(res.body.porPersona).toContainEqual({
        usuario: { id: 'carla', nombre: 'carla' },
        total: 2,
      });
      expect(res.body.porCriterio).toContainEqual({
        criterio: { id: 'motor', nombre: 'Motor' },
        total: expect.any(Number),
      });
      const suma = (lista: { total: number }[]) => lista.reduce((s, g) => s + g.total, 0);
      expect(suma(res.body.porEstado)).toBe(total);
      expect(suma(res.body.porCriterio)).toBe(total);
    });
  });
});
