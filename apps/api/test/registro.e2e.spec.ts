// Pruebas de punta a punta contra PostgreSQL real (base aparte `toqui_test`, se recrea en cada corrida).
// El dataset es un fixture sintético mínimo generado aquí; el dataset público no se copia al repositorio.
// S3 se reemplaza por un doble: la API solo firma URLs.
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MensajeCapturaSchema } from '@toqui/shared';
import { AlmacenamientoService } from '../src/aws/almacenamiento.service';
import { ColaService } from '../src/aws/cola.service';
import { hoyEn, sumarDias } from '../src/comun/fechas';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { cargarDataset, leerDataset } from '../src/seed/dataset';

const URL_ADMIN =
  process.env['TEST_DATABASE_ADMIN_URL'] ?? 'postgresql://toqui:toqui_local@localhost:5432/toqui';
const BASE_PRUEBA = 'toqui_test';
const URL_PRUEBA = URL_ADMIN.replace(/\/[^/?]+(\?|$)/, `/${BASE_PRUEBA}$1`);
const TOKEN_PIPELINE = 'secreto-del-pipeline-de-prueba';

// En AUTH_MODE=local, sin cabecera es la educadora fija de JAR-0001.
const OTRA_EDUCADORA = 'Bearer local:educadora:JAR-0001:otra';
const DIRECTORA = 'Bearer local:directora:JAR-0001:dora';
const EDUCADORA_J2 = 'Bearer local:educadora:JAR-0002:edu2';

const HOY = hoyEn('America/Santiago');
const DOMINIOS = {
  MG: 'motor_grueso',
  MF: 'motor_fino',
  LC: 'lenguaje_comunicacion',
  SE: 'socioemocional',
  CO: 'cognitivo',
};
const RANGOS = [
  [0, 2],
  [2, 4],
  [4, 7],
  [7, 10],
  [10, 13],
  [13, 18],
  [18, 24],
  [24, 30],
  [30, 36],
] as const;

/** Escribe un dataset sintético mínimo con el formato de los CSV públicos. */
function escribirFixture(dir: string): void {
  const csv = (nombre: string, filas: string[]) =>
    writeFileSync(join(dir, nombre), `${filas.join('\n')}\n`);
  csv('jardines.csv', [
    'id_jardin,nombre_fantasia,comuna,region,numero_salas,numero_educadoras',
    'JAR-0001,Jardín de Prueba Uno,Arica,Arica y Parinacota,2,1',
    'JAR-0002,"Jardín de Prueba, Dos",Iquique,Tarapacá,1,1',
  ]);
  csv('educadoras.csv', [
    'id_educadora,id_jardin,rol,anios_experiencia',
    'EDU-0001,JAR-0001,educadora_parvulos,5',
    'EDU-0002,JAR-0002,tecnico_parvulos,2',
  ]);
  // NINO-00001 cumple 21 meses hoy o cerca: nivel esperado 7 (18–24 meses).
  const nacimiento = sumarDias(HOY, -21 * 30.5);
  csv('ninos.csv', [
    'id_nino,fecha_nacimiento,sexo_registrado,id_jardin,sala_grupo,fecha_ingreso',
    `NINO-00001,${nacimiento},f,JAR-0001,SG-A,${nacimiento}`,
    'NINO-00002,2024-01-01,m,JAR-0001,SG-B,2024-03-01',
    'NINO-00003,2024-01-01,x,JAR-0002,SG-A,2024-03-01',
  ]);
  csv('ruta_niveles.csv', [
    'nivel,nombre_nivel,edad_min_meses,edad_max_meses,dominios,descripcion',
    ...RANGOS.map(
      ([min, max], i) =>
        `${i + 1},Nivel ${i + 1},${min},${max},motor_grueso|motor_fino|lenguaje_comunicacion|socioemocional|cognitivo,"Descripción, sintética"`,
    ),
  ]);
  const manifestaciones = RANGOS.flatMap((_, i) =>
    Object.entries(DOMINIOS).map(
      ([codigo, dominio]) =>
        `MAN-L${String(i + 1).padStart(2, '0')}-${codigo}-01,${i + 1},${dominio},Manifestación de prueba ${codigo} ${i + 1}.`,
    ),
  );
  csv('manifestaciones.csv', [
    'id_manifestacion,nivel,dominio,texto_observable',
    ...manifestaciones,
  ]);
  csv('observaciones.csv', [
    'id_observacion,id_nino,id_educadora,fecha_observacion,formato_captura,nivel_estimado,nota_breve',
    `OBS-0000001,NINO-00001,EDU-0001,${sumarDias(HOY, -10)},texto,6,`,
    `OBS-0000002,NINO-00001,EDU-0001,${sumarDias(HOY, -400)},audio,5,Fuera del periodo`,
  ]);
  csv('observacion_manifestaciones.csv', [
    'id_observacion,id_manifestacion',
    'OBS-0000001,MAN-L06-CO-01',
    'OBS-0000002,MAN-L05-CO-01',
  ]);
}

jest.setTimeout(60_000);

describe('API de registro (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dirDataset: string;
  const almacenamiento = {
    firmarSubida: jest.fn(),
    describirArchivo: jest.fn(),
    firmarLectura: jest.fn(),
    comprobarBucket: jest.fn(),
  };
  const cola = { enviar: jest.fn(), comprobar: jest.fn() };
  const http = () => request(app.getHttpServer());

  async function iniciarApp(env: Record<string, string>): Promise<INestApplication> {
    Object.assign(process.env, env);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AlmacenamientoService)
      .useValue(almacenamiento)
      .overrideProvider(ColaService)
      .useValue(cola)
      .compile();
    const nueva = moduleRef.createNestApplication();
    await nueva.init();
    return nueva;
  }

  beforeAll(async () => {
    const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL_ADMIN }) });
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${BASE_PRUEBA} WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${BASE_PRUEBA}`);
    await admin.$disconnect();
    execSync('pnpm exec prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: URL_PRUEBA },
      stdio: 'ignore',
    });

    app = await iniciarApp({
      DATABASE_URL: URL_PRUEBA,
      AUTH_MODE: 'local',
      PIPELINE_MODE: 'inline',
      PIPELINE_TOKEN: TOKEN_PIPELINE,
    });
    prisma = app.get(PrismaService);

    dirDataset = mkdtempSync(join(tmpdir(), 'dataset-e1-'));
    escribirFixture(dirDataset);
    await expect(cargarDataset(prisma, leerDataset(dirDataset))).resolves.toMatchObject({
      cargado: true,
      conteos: { jardines: 2, ninos: 3, niveles: 9, manifestaciones: 45, vinculos: 2 },
    });
  });

  afterAll(async () => {
    await app?.close();
    rmSync(dirDataset, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.resetAllMocks();
    almacenamiento.firmarSubida.mockImplementation(async (id: string, tipo: string) => ({
      clave: `capturas/${id}.webm`,
      subida: {
        url: `https://s3.example.com/capturas/${id}.webm?firma=1`,
        metodo: 'PUT',
        cabeceras: { 'Content-Type': tipo },
        expiraEn: new Date().toISOString(),
      },
    }));
    almacenamiento.describirArchivo.mockResolvedValue({ tipo: 'audio/webm', tamano: 50_000 });
    almacenamiento.firmarLectura.mockImplementation(async (clave: string) => ({
      url: `https://s3.example.com/${clave}?lectura=1`,
      expiraEn: new Date().toISOString(),
    }));
  });

  /** Espera a que el pipeline inline deje la captura fuera de `procesando`. */
  async function esperarBorrador(id: string, token?: string) {
    for (let i = 0; i < 40; i++) {
      const req = http().get(`/capturas/${id}`);
      const res = await (token ? req.set('Authorization', token) : req);
      if (res.body.estado !== 'procesando') return res.body;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`La captura ${id} sigue procesando`);
  }

  async function crearTexto(
    texto = 'Apiló cuatro bloques solo y aplaudió. Luego siguió jugando.',
    token?: string,
  ) {
    const req = http().post('/capturas');
    const res = await (token ? req.set('Authorization', token) : req)
      .send({ idNino: 'NINO-00001', formato: 'texto', texto })
      .expect(201);
    return res.body.captura.id as string;
  }

  describe('carga del dataset', () => {
    it('no se repite si la base ya tiene datos', async () => {
      await expect(cargarDataset(prisma, leerDataset(dirDataset))).resolves.toEqual({
        cargado: false,
        motivo: expect.stringContaining('ya tiene jardines'),
      });
    });

    it('falla con un error explícito si falta la carpeta, un archivo o una fila es inválida', () => {
      expect(() => leerDataset(undefined)).toThrow(/DATASET_DIR no está definida/);
      expect(() => leerDataset(join(dirDataset, 'no-existe'))).toThrow(/no contiene: jardines.csv/);
      const roto = mkdtempSync(join(tmpdir(), 'dataset-roto-'));
      escribirFixture(roto);
      writeFileSync(
        join(roto, 'jardines.csv'),
        'id_jardin,nombre_fantasia,comuna,region,numero_salas,numero_educadoras\nJAR-1,X,Y,Z,99,1\n',
      );
      expect(() => leerDataset(roto)).toThrow(/jardines.csv, fila 2/);
      rmSync(roto, { recursive: true, force: true });
    });

    it('genera nombres sintéticos y conserva IDs, fechas y la nota vacía como null', async () => {
      const nino = await prisma.nino.findUniqueOrThrow({ where: { id: 'NINO-00001' } });
      expect(nino.nombres).toEqual(expect.any(String));
      expect(nino.apellidos.split(' ')).toHaveLength(2);
      const obs = await prisma.observacion.findUniqueOrThrow({ where: { id: 'OBS-0000001' } });
      expect(obs).toMatchObject({ notaBreve: null, origen: 'dataset', idEducadora: 'EDU-0001' });
      const jardin = await prisma.jardin.findUniqueOrThrow({ where: { id: 'JAR-0002' } });
      expect(jardin.nombreFantasia).toBe('Jardín de Prueba, Dos');
    });
  });

  describe('autenticación y jardín', () => {
    it('/health es público; en modo local sin token es la educadora de JAR-0001', async () => {
      await http().get('/health').expect(200);
      const res = await http().get('/me').expect(200);
      expect(res.body).toMatchObject({ grupo: 'educadora', idJardin: 'JAR-0001' });
      await http().get('/me').set('Authorization', 'Bearer cualquiera').expect(401);
    });

    it('lista solo los niños y niñas del jardín, con filtro por sala', async () => {
      const todos = await http().get('/ninos').expect(200);
      expect(todos.body.map((n: { id: string }) => n.id).sort()).toEqual([
        'NINO-00001',
        'NINO-00002',
      ]);
      expect(todos.body[0]).toMatchObject({
        edadMeses: expect.any(Number),
        nombres: expect.any(String),
      });
      const sala = await http().get('/ninos?sala=SG-B').expect(200);
      expect(sala.body.map((n: { id: string }) => n.id)).toEqual(['NINO-00002']);
      const otro = await http().get('/ninos').set('Authorization', EDUCADORA_J2).expect(200);
      expect(otro.body.map((n: { id: string }) => n.id)).toEqual(['NINO-00003']);
    });

    it('catálogo de manifestaciones filtrable por nivel y dominio', async () => {
      const res = await http().get('/manifestaciones?nivel=7&dominio=motor_fino').expect(200);
      expect(res.body).toEqual([
        {
          id: 'MAN-L07-MF-01',
          nivel: 7,
          dominio: 'motor_fino',
          textoObservable: expect.any(String),
        },
      ]);
      await http().get('/manifestaciones?nivel=10').expect(400);
    });
  });

  describe('trayectoria', () => {
    it('por dominio, con «sin registros» y evidencia limitada', async () => {
      const res = await http().get('/ninos/NINO-00001/trayectoria').expect(200);
      expect(res.body).toMatchObject({
        totalObservaciones: 1,
        evidenciaLimitada: true,
        hasta: HOY,
      });
      const cognitivo = res.body.dominios.find(
        (d: { dominio: string }) => d.dominio === 'cognitivo',
      );
      expect(cognitivo).toMatchObject({
        sinRegistros: false,
        puntos: [{ idObservacion: 'OBS-0000001', nivelEstimado: 6, origen: 'dataset' }],
      });
      const motor = res.body.dominios.find(
        (d: { dominio: string }) => d.dominio === 'motor_grueso',
      );
      expect(motor).toEqual({ dominio: 'motor_grueso', sinRegistros: true, puntos: [] });

      const amplio = await http()
        .get(`/ninos/NINO-00001/trayectoria?desde=${sumarDias(HOY, -500)}`)
        .expect(200);
      expect(amplio.body.totalObservaciones).toBe(2);
    });

    it('403 para otro jardín y 404 si no existe', async () => {
      await http().get('/ninos/NINO-00003/trayectoria').expect(403);
      await http().get('/ninos/NINO-99999/trayectoria').expect(404);
    });
  });

  describe('captura y borrador (pipeline inline, proveedor fake)', () => {
    it('crea la captura en procesando y el pipeline deja un borrador válido con cita', async () => {
      const res = await http()
        .post('/capturas')
        .send({
          idNino: 'NINO-00001',
          formato: 'texto',
          texto: 'Apiló cuatro bloques solo y aplaudió. Luego siguió.',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        captura: { estado: 'procesando', borrador: null },
        subida: null,
      });

      const captura = await esperarBorrador(res.body.captura.id);
      expect(captura).toMatchObject({
        estado: 'borrador_listo',
        borrador: {
          nivelSugerido: 7,
          evidenciaInsuficiente: false,
          proveedor: 'fake',
          manifestaciones: [
            {
              manifestacion: { id: 'MAN-L07-MF-01', dominio: 'motor_fino' },
              cita: 'Apiló cuatro bloques solo y aplaudió.',
            },
          ],
        },
      });
      const eventos = await prisma.eventoTiempo.findMany({ where: { idCaptura: captura.id } });
      expect(eventos.map((e) => e.tipo).sort()).toEqual(['borrador_listo', 'inicio']);
    });

    it('texto sin pistas: borrador con evidencia insuficiente', async () => {
      const id = await crearTexto('Hoy estuvo tranquila toda la mañana en la sala.');
      await expect(esperarBorrador(id)).resolves.toMatchObject({
        borrador: { evidenciaInsuficiente: true, nivelSugerido: null, manifestaciones: [] },
      });
    });

    it('audio: devuelve el PUT firmado para `capturas/<id>.<ext>`', async () => {
      const res = await http()
        .post('/capturas')
        .send({
          idNino: 'NINO-00001',
          formato: 'audio',
          archivo: { tipo: 'audio/webm', tamano: 50_000 },
        })
        .expect(201);
      expect(almacenamiento.firmarSubida).toHaveBeenCalledWith(
        res.body.captura.id,
        'audio/webm',
        50_000,
      );
      expect(res.body.subida).toMatchObject({
        metodo: 'PUT',
        cabeceras: { 'Content-Type': 'audio/webm' },
      });
      expect(res.body.captura.tieneArchivo).toBe(true);
    });

    /** Audio recién creado: queda en `procesando` hasta que la web confirme la subida. */
    async function crearAudio(token?: string): Promise<string> {
      const req = http().post('/capturas');
      const res = await (token ? req.set('Authorization', token) : req)
        .send({
          idNino: 'NINO-00001',
          formato: 'audio',
          archivo: { tipo: 'audio/webm', tamano: 50_000 },
        })
        .expect(201);
      return res.body.captura.id as string;
    }

    it('audio: se procesa recién al confirmar la subida, y una sola vez', async () => {
      const id = await crearAudio();
      await new Promise((r) => setTimeout(r, 200));
      await expect(prisma.captura.findUnique({ where: { id } })).resolves.toMatchObject({
        estado: 'procesando',
        encoladaEn: null,
      });

      await http().post(`/capturas/${id}/subida-completa`).expect(200);
      expect(almacenamiento.describirArchivo).toHaveBeenCalledWith(`capturas/${id}.webm`);
      const captura = await esperarBorrador(id);
      expect(captura).toMatchObject({ estado: 'borrador_listo', borrador: { proveedor: 'fake' } });

      // Un aviso repetido no vuelve a procesar ni falla.
      const repetido = await http().post(`/capturas/${id}/subida-completa`).expect(200);
      expect(repetido.body.estado).toBe('borrador_listo');
    });

    it('409 si el archivo no está en S3 o tiene otro tipo; la captura sigue esperando', async () => {
      const id = await crearAudio();
      almacenamiento.describirArchivo.mockResolvedValueOnce(null);
      await http().post(`/capturas/${id}/subida-completa`).expect(409);
      almacenamiento.describirArchivo.mockResolvedValueOnce({ tipo: 'image/png', tamano: 10 });
      await http().post(`/capturas/${id}/subida-completa`).expect(409);
      await expect(prisma.captura.findUnique({ where: { id } })).resolves.toMatchObject({
        estado: 'procesando',
        encoladaEn: null,
      });
    });

    it('subida completa: 409 para una nota de texto, 403 si no es tuya, 404 si es de otro jardín', async () => {
      const texto = await crearTexto();
      await http().post(`/capturas/${texto}/subida-completa`).expect(409);
      const audio = await crearAudio();
      await http()
        .post(`/capturas/${audio}/subida-completa`)
        .set('Authorization', OTRA_EDUCADORA)
        .expect(403);
      await http()
        .post(`/capturas/${audio}/subida-completa`)
        .set('Authorization', 'Bearer local:educadora:JAR-0002')
        .expect(404);
    });

    it('valida el cuerpo, el jardín y el grupo', async () => {
      const crear = (body: object, token?: string) => {
        const req = http().post('/capturas');
        return (token ? req.set('Authorization', token) : req).send(body);
      };
      await crear({ idNino: 'NINO-00001', formato: 'texto' }).expect(400);
      await crear({
        idNino: 'NINO-00001',
        formato: 'audio',
        archivo: { tipo: 'image/png', tamano: 10 },
      }).expect(400);
      await crear({
        idNino: 'NINO-00001',
        formato: 'foto',
        archivo: { tipo: 'image/png', tamano: 11 * 1024 * 1024 },
      }).expect(400);
      await crear({ idNino: 'NINO-00003', formato: 'texto', texto: 'de otro jardín' }).expect(403);
      await crear({ idNino: 'NINO-99999', formato: 'texto', texto: 'no existe' }).expect(404);
      await crear({ idNino: 'NINO-00001', formato: 'texto', texto: 'directora' }, DIRECTORA).expect(
        403,
      );
    });

    it('capturas de otro jardín o ids inválidos responden 404', async () => {
      const id = await crearTexto();
      await http().get(`/capturas/${id}`).set('Authorization', EDUCADORA_J2).expect(404);
      await http().get('/capturas/no-es-uuid').expect(404);
      await http().get(`/capturas/${id}`).set('Authorization', DIRECTORA).expect(200);
    });
  });

  describe('confirmación, corrección y descarte', () => {
    it('confirmar sin cambios crea la observación con citas y una corrección «confirmada»', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      const res = await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({
          nivel: 7,
          manifestaciones: [
            { idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques solo y aplaudió.' },
          ],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        estado: 'confirmada',
        observacion: {
          id: `APP-${id}`,
          nivelEstimado: 7,
          fecha: HOY,
          manifestaciones: [
            {
              manifestacion: { id: 'MAN-L07-MF-01' },
              cita: 'Apiló cuatro bloques solo y aplaudió.',
            },
          ],
        },
      });
      await expect(
        prisma.correccion.findUnique({ where: { idCaptura: id } }),
      ).resolves.toMatchObject({
        decision: 'confirmada',
      });
      const obs = await prisma.observacion.findUniqueOrThrow({ where: { id: `APP-${id}` } });
      expect(obs).toMatchObject({
        origen: 'app',
        idCaptura: id,
        idUsuario: 'local-educadora',
        formatoCaptura: 'texto',
      });
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({ nivel: 7, manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01' }] })
        .expect(409);
    });

    it('corregir conserva la sugerencia original de la IA', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({
          nivel: 6,
          manifestaciones: [
            { idManifestacion: 'MAN-L06-SE-01' },
            { idManifestacion: 'MAN-L06-MF-01' },
          ],
        })
        .expect(200);
      const correccion = await prisma.correccion.findUniqueOrThrow({ where: { idCaptura: id } });
      expect(correccion).toMatchObject({
        decision: 'corregida',
        sugerencia: { nivel: 7, manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01' }] },
        final: { nivel: 6 },
      });
      await expect(prisma.borrador.findUnique({ where: { idCaptura: id } })).resolves.toMatchObject(
        { nivelSugerido: 7 },
      );
    });

    it('422 si una manifestación no existe o no es del nivel elegido; 400 si hay más de 5 o repetidas', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      const confirmar = (body: object) => http().post(`/capturas/${id}/confirmacion`).send(body);
      await confirmar({ nivel: 7, manifestaciones: [{ idManifestacion: 'MAN-L06-MF-01' }] }).expect(
        422,
      );
      await confirmar({ nivel: 7, manifestaciones: [{ idManifestacion: 'MAN-NO-EXISTE' }] }).expect(
        422,
      );
      await confirmar({
        nivel: 7,
        manifestaciones: [
          { idManifestacion: 'MAN-L07-MF-01' },
          { idManifestacion: 'MAN-L07-MF-01' },
        ],
      }).expect(400);
      await confirmar({ nivel: 7, manifestaciones: [] }).expect(400);
    });

    it('solo quien registró decide; la directora y otras educadoras reciben 403', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      const body = { nivel: 7, manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01' }] };
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .set('Authorization', OTRA_EDUCADORA)
        .send(body)
        .expect(403);
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .set('Authorization', DIRECTORA)
        .send(body)
        .expect(403);
      await http()
        .post(`/capturas/${id}/descarte`)
        .set('Authorization', OTRA_EDUCADORA)
        .expect(403);
    });

    it('descartar no crea observación y registra el descarte', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      const res = await http().post(`/capturas/${id}/descarte`).expect(200);
      expect(res.body).toMatchObject({ estado: 'descartada', observacion: null });
      await expect(
        prisma.correccion.findUnique({ where: { idCaptura: id } }),
      ).resolves.toMatchObject({
        decision: 'descartada',
        final: null,
      });
      await expect(prisma.observacion.count({ where: { idCaptura: id } })).resolves.toBe(0);
      const eventos = await prisma.eventoTiempo.findMany({ where: { idCaptura: id } });
      expect(eventos.map((e) => e.tipo)).toContain('descarte');
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({ nivel: 7, manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01' }] })
        .expect(409);
    });
  });

  describe('endpoint interno del pipeline', () => {
    /** Captura que queda en `procesando` (audio: el pipeline inline no la toca hasta que se programa). */
    async function capturaProcesando(): Promise<string> {
      const id = (
        await prisma.captura.create({
          data: {
            idNino: 'NINO-00001',
            idJardin: 'JAR-0001',
            idUsuario: 'local-educadora',
            autor: 'Educadora local',
            formato: 'audio',
            archivoClave: 'capturas/x.webm',
            fecha: new Date(`${HOY}T00:00:00Z`),
          },
        })
      ).id;
      return id;
    }
    const entregar = (id: string, body: object, token = TOKEN_PIPELINE) =>
      http().post(`/interno/capturas/${id}/borrador`).set('x-pipeline-token', token).send(body);
    const valido = {
      textoFuente: 'Saltó en la rampa con los dos pies.',
      nivelSugerido: 7,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MG-01', cita: 'Saltó en la rampa' }],
      proveedor: 'bedrock',
      modelo: 'us.anthropic.claude-sonnet-5-5',
    };

    it('401 sin el secreto del pipeline; no usa el token de Cognito', async () => {
      const id = await capturaProcesando();
      await entregar(id, valido, 'otro-secreto-cualquiera').expect(401);
      await http().post(`/interno/capturas/${id}/borrador`).send(valido).expect(401);
    });

    it('idempotente por captura: reintentos y entregas simultáneas dejan un solo borrador', async () => {
      const id = await capturaProcesando();
      const respuestas = await Promise.all([
        entregar(id, valido),
        entregar(id, valido),
        entregar(id, valido),
      ]);
      expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200]);
      await entregar(id, { ...valido, nivelSugerido: 6, manifestaciones: [] }).expect(200);
      await expect(prisma.borrador.count({ where: { idCaptura: id } })).resolves.toBe(1);
      await expect(prisma.borrador.findUnique({ where: { idCaptura: id } })).resolves.toMatchObject(
        { nivelSugerido: 7 },
      );
      await expect(prisma.captura.findUnique({ where: { id } })).resolves.toMatchObject({
        estado: 'borrador_listo',
      });
    });

    it('422 si una cita no está en el texto, el nivel no calza o la evidencia es contradictoria', async () => {
      const id = await capturaProcesando();
      await entregar(id, {
        ...valido,
        manifestaciones: [{ idManifestacion: 'MAN-L07-MG-01', cita: 'inventada' }],
      }).expect(422);
      await entregar(id, { ...valido, nivelSugerido: 6 }).expect(422);
      await entregar(id, { ...valido, evidenciaInsuficiente: true }).expect(422);
      await entregar(id, { ...valido, manifestaciones: [] }).expect(422);
      await expect(prisma.borrador.count({ where: { idCaptura: id } })).resolves.toBe(0);
    });

    it('un error del pipeline deja la captura en error; la educadora aún puede decidir a mano', async () => {
      const id = await capturaProcesando();
      await http()
        .post(`/interno/capturas/${id}/error`)
        .set('x-pipeline-token', TOKEN_PIPELINE)
        .send({ detalle: 'Transcribe falló' })
        .expect(200, { id, estado: 'error' });
      const res = await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({ nivel: 7, manifestaciones: [{ idManifestacion: 'MAN-L07-MG-01' }] })
        .expect(200);
      expect(res.body.estado).toBe('confirmada');
      await expect(
        prisma.correccion.findUnique({ where: { idCaptura: id } }),
      ).resolves.toMatchObject({
        decision: 'corregida',
        sugerencia: { nivel: null, manifestaciones: [] },
      });
    });

    it('404 para capturas inexistentes o ids inválidos', async () => {
      await entregar('00000000-0000-4000-8000-000000000000', valido).expect(404);
      await entregar('no-es-uuid', valido).expect(404);
    });
  });

  describe('listado y archivo', () => {
    it('lista las notas del jardín con filtros y paginación', async () => {
      const mia = await crearTexto('Nota propia para el listado con bloques.');
      const otra = await crearTexto('Nota de otra educadora con bloques.', OTRA_EDUCADORA);
      await esperarBorrador(mia);
      await esperarBorrador(otra);

      const mias = await http().get('/capturas?mias=true&tamano=100').expect(200);
      const ids = mias.body.items.map((c: { id: string }) => c.id);
      expect(ids).toContain(mia);
      expect(ids).not.toContain(otra);

      const pagina = await http()
        .get('/capturas?tamano=1&pagina=2')
        .set('Authorization', DIRECTORA)
        .expect(200);
      expect(pagina.body.items).toHaveLength(1);
      expect(pagina.body.total).toBeGreaterThan(2);

      const sala = await http().get(`/capturas?sala=SG-B&desde=${HOY}&hasta=${HOY}`).expect(200);
      expect(sala.body.total).toBe(0);
      const deOtroJardin = await http()
        .get('/capturas')
        .set('Authorization', EDUCADORA_J2)
        .expect(200);
      expect(deOtroJardin.body.total).toBe(0);

      const item = mias.body.items.find((c: { id: string }) => c.id === mia);
      expect(item).toMatchObject({
        estado: 'borrador_listo',
        dominios: ['motor_fino'],
        nino: { sala: 'SG-A' },
      });
    });

    it('URL temporal del original; 404 si es texto', async () => {
      const res = await http()
        .post('/capturas')
        .send({
          idNino: 'NINO-00001',
          formato: 'audio',
          archivo: { tipo: 'audio/webm', tamano: 10 },
        })
        .expect(201);
      const archivo = await http().get(`/capturas/${res.body.captura.id}/archivo`).expect(200);
      expect(archivo.body).toMatchObject({
        tipo: 'audio/webm',
        url: expect.stringContaining('?lectura=1'),
      });
      const texto = await crearTexto();
      await http().get(`/capturas/${texto}/archivo`).expect(404);
    });
  });

  describe('PIPELINE_MODE=cola', () => {
    let appCola: INestApplication;
    beforeAll(async () => {
      appCola = await iniciarApp({
        PIPELINE_MODE: 'cola',
        SQS_URL_CAPTURAS: 'https://sqs.us-east-1.amazonaws.com/111111111111/toqui-prueba',
      });
    });
    afterAll(async () => {
      await appCola.close();
      process.env['PIPELINE_MODE'] = 'inline';
      delete process.env['SQS_URL_CAPTURAS'];
    });

    it('el texto se encola con un mensaje válido y sin datos personales', async () => {
      const res = await request(appCola.getHttpServer())
        .post('/capturas')
        .send({ idNino: 'NINO-00001', formato: 'texto', texto: 'Nota que procesa la Lambda.' })
        .expect(201);
      const id = res.body.captura.id as string;
      expect(cola.enviar).toHaveBeenCalledTimes(1);
      const mensaje = MensajeCapturaSchema.parse(cola.enviar.mock.calls[0]![0]);
      expect(mensaje).toMatchObject({
        idCaptura: id,
        idUsuario: 'local-educadora',
        idJardin: 'JAR-0001',
        formato: 'texto',
        texto: 'Nota que procesa la Lambda.',
      });
      // Catálogo completo de la ruta, y nada que identifique al niño o niña.
      expect(mensaje.catalogo).toHaveLength(45);
      expect(new Set(mensaje.catalogo.map((m) => m.nivel)).size).toBe(9);
      expect(JSON.stringify(mensaje)).not.toMatch(/NINO-|idNino|nombres|apellidos/);
      await new Promise((r) => setTimeout(r, 200));
      await expect(prisma.captura.findUnique({ where: { id } })).resolves.toMatchObject({
        estado: 'procesando',
      });
    });

    it('el audio se encola al confirmar la subida, una sola vez', async () => {
      const res = await request(appCola.getHttpServer())
        .post('/capturas')
        .send({
          idNino: 'NINO-00001',
          formato: 'audio',
          archivo: { tipo: 'audio/webm', tamano: 50_000 },
        })
        .expect(201);
      const id = res.body.captura.id as string;
      expect(cola.enviar).not.toHaveBeenCalled();
      await request(appCola.getHttpServer()).post(`/capturas/${id}/subida-completa`).expect(200);
      await request(appCola.getHttpServer()).post(`/capturas/${id}/subida-completa`).expect(200);
      expect(cola.enviar).toHaveBeenCalledTimes(1);
      expect(cola.enviar.mock.calls[0]![0]).toMatchObject({
        idCaptura: id,
        formato: 'audio',
        archivoClave: `capturas/${id}.webm`,
        archivoTipo: 'audio/webm',
      });
    });

    it('si la cola falla, la captura queda en error y responde 503', async () => {
      cola.enviar.mockRejectedValueOnce(new Error('SQS caído'));
      await request(appCola.getHttpServer())
        .post('/capturas')
        .send({ idNino: 'NINO-00001', formato: 'texto', texto: 'Falla al subir.' })
        .expect(503);
      await expect(
        prisma.captura.findFirst({ where: { texto: 'Falla al subir.' } }),
      ).resolves.toMatchObject({
        estado: 'error',
      });
    });
  });
});
