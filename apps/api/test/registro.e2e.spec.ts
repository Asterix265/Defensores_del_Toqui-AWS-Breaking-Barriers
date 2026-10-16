// Pruebas de punta a punta contra PostgreSQL real (base aparte `toqui_test`, se recrea en cada corrida).
// El dataset es un fixture sintético mínimo con el formato del dataset E1 por núcleos, generado
// aquí; el dataset no se copia al repositorio.
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
import { RetencionService } from '../src/capturas/retencion.service';
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
const NUCLEOS = ['IA', 'CM', 'LV'];
const NIVELES = [1, 2, 3, 4, 5, 6, 7, 8];

/** Manifestación de conducta del descriptor de prueba (`MAN-RUB-T-SC-CM-03-C`). */
const man = (ne: string, nucleo: string, nivel: number, tipo: 'C' | 'E1' = 'C') =>
  `MAN-RUB-T-${ne}-${nucleo}-0${nivel}-${tipo}`;

/** Escribe un dataset sintético mínimo con el formato de los CSV del dataset E1 por núcleos. */
function escribirFixture(dir: string): void {
  const csv = (nombre: string, filas: string[]) =>
    writeFileSync(join(dir, nombre), `${filas.join('\n')}\n`);
  csv('niveles_educativos.csv', [
    'id_nivel_educativo,nombre,edad_min_meses_contexto,edad_max_meses_exclusiva_contexto',
    'SC,Sala Cuna,0,24',
    'NM,Nivel Medio,24,48',
    'TR,Transición,48,72',
  ]);
  csv('nucleos.csv', [
    'id_nucleo,nombre,ambito,archivo_rubrica,origen',
    'IA,Identidad y Autonomía,Desarrollo Personal y Social,rubricas/ia.md,referencia_aportada_usuario',
    'CM,Corporalidad y Movimiento,Desarrollo Personal y Social,rubricas/cm.md,propuesta_sintetica',
    'LV,Lenguaje Verbal,Comunicación Integral,rubricas/lv.md,propuesta_sintetica',
  ]);
  csv('niveles_trayectoria.csv', ['nivel,nombre_nivel', ...NIVELES.map((n) => `${n},Nivel ${n}`)]);
  csv('versiones_rubrica.csv', [
    'id_version,fecha_version,estado,archivo_referencia,nucleos_activos,niveles_activos',
    'E1-TEST,2026-10-16,prueba,fuentes/ref.txt,3,8',
  ]);
  csv('jardines.csv', [
    'id_jardin,nombre_fantasia,comuna,region,numero_salas,numero_educadoras,numero_asistentes,id_directora',
    'JAR-0001,Jardín de Prueba Uno,Arica,Arica y Parinacota,2,1,1,DIR-0001',
    'JAR-0002,"Jardín de Prueba, Dos",Iquique,Tarapacá,1,1,0,',
  ]);
  csv('educadoras.csv', [
    'id_educadora,id_jardin,nombre_completo,rol,anios_experiencia',
    'DIR-0001,JAR-0001,Directora Ficticia 1,directora,15',
    'EDU-0001,JAR-0001,Educadora Ficticia 1,educadora_parvulos,5',
    'ASI-0001,JAR-0001,Persona Ficticia ASI-0001,asistente_parvulos,2',
    'EDU-0002,JAR-0002,Educadora Ficticia 2,educadora_parvulos,3',
  ]);
  csv('salas.csv', [
    'id_sala,id_jardin,sala_grupo,id_nivel_educativo,id_educadora_responsable',
    'JAR-0001-SC-01,JAR-0001,SC-01,SC,EDU-0001',
    'JAR-0001-NM-01,JAR-0001,NM-01,NM,EDU-0001',
    'JAR-0002-SC-01,JAR-0002,SC-01,SC,EDU-0002',
  ]);
  csv('personal_salas.csv', [
    'id_educadora,id_sala',
    'EDU-0001,JAR-0001-SC-01',
    'ASI-0001,JAR-0001-SC-01',
    'EDU-0001,JAR-0001-NM-01',
    'EDU-0002,JAR-0002-SC-01',
  ]);
  const nacimiento = sumarDias(HOY, -14 * 30.5);
  csv('ninos.csv', [
    'id_nino,nombre_completo,nombre_registro,fecha_nacimiento,sexo_registrado,id_jardin,sala_grupo,id_sala,id_nivel_educativo,fecha_ingreso',
    `NINO-00001,Sofía Prueba 001,Sofía Prueba,${nacimiento},f,JAR-0001,SC-01,JAR-0001-SC-01,SC,${nacimiento}`,
    'NINO-00002,Mateo Ejemplo 002,Mateo,2023-01-01,m,JAR-0001,NM-01,JAR-0001-NM-01,NM,2024-03-01',
    'NINO-00003,Antonia Ejemplo 003,Antonia,2025-01-01,x,JAR-0002,SC-01,JAR-0002-SC-01,SC,2025-03-01',
  ]);
  const descriptores = ['SC', 'NM'].flatMap((ne) =>
    NUCLEOS.flatMap((nucleo) => NIVELES.map((nivel) => ({ ne, nucleo, nivel }))),
  );
  csv('ruta_niveles.csv', [
    'id_descriptor,id_version,id_nivel_educativo,id_nucleo,nivel,nombre_nivel,desarrollo_esperado,conducta_observable,ejemplo_1,ejemplo_2,origen,paso_siguiente_sugerido',
    ...descriptores.map(
      ({ ne, nucleo, nivel }) =>
        `RUB-T-${ne}-${nucleo}-0${nivel},E1-TEST,${ne},${nucleo},${nivel},Nivel ${nivel},"Desarrollo, sintético",Conducta,Ejemplo 1,Ejemplo 2,propuesta_sintetica,`,
    ),
  ]);
  csv('manifestaciones.csv', [
    'id_manifestacion,id_descriptor,tipo,texto_observable,origen',
    ...descriptores.flatMap(({ ne, nucleo, nivel }) => [
      `${man(ne, nucleo, nivel)},RUB-T-${ne}-${nucleo}-0${nivel},conducta_descriptor,Conducta ${nucleo} ${nivel}.,propuesta_sintetica`,
      `${man(ne, nucleo, nivel, 'E1')},RUB-T-${ne}-${nucleo}-0${nivel},ejemplo_ilustrativo,Ejemplo ${nucleo} ${nivel}.,propuesta_sintetica`,
    ]),
  ]);
  csv('observaciones.csv', [
    'id_observacion,id_nino,id_educadora,fecha_observacion,formato_captura,nota_breve,texto_observacion,contexto,apoyos,edad_meses_observacion,origen',
    `OBS-0000001,NINO-00001,EDU-0001,${sumarDias(HOY, -10)},texto,,Se puso los zapatos sola y sonrió.,Hora de salida,Sin apoyo,14,registro_sintetico`,
    `OBS-0000002,NINO-00001,ASI-0001,${sumarDias(HOY, -400)},texto,Fuera del periodo,Pidió ayuda para el zapato.,Patio,Con apoyo,1,registro_sintetico`,
  ]);
  csv('observacion_manifestaciones.csv', [
    'id_evidencia,id_observacion,id_manifestacion,fragmento_evidencia,alcance',
    `EVI-0000001,OBS-0000001,${man('SC', 'IA', 3)},Se puso los zapatos sola,componente_observado`,
    `EVI-0000002,OBS-0000002,${man('SC', 'IA', 2)},Pidió ayuda,parcial_otro_descriptor`,
  ]);
  csv('valoraciones.csv', [
    'id_valoracion,id_nino,id_sala,id_nivel_educativo,id_nucleo,id_version,fecha_corte,nivel_sugerido,nivel_validado,estado,id_educadora_decide,fecha_decision,id_observacion_sin_clasificar,justificacion_sugerencia,justificacion_decision,paso_siguiente_sugerido',
    `VAL-0000001,NINO-00001,JAR-0001-SC-01,SC,IA,E1-TEST,${sumarDias(HOY, -9)},3,3,confirmada,EDU-0001,${sumarDias(HOY, -9)},,Evidencia EVI-0000001,Confirma,Observar el nivel 4`,
    `VAL-0000002,NINO-00001,JAR-0001-SC-01,SC,CM,E1-TEST,${sumarDias(HOY, -9)},,,evidencia_insuficiente,EDU-0001,${sumarDias(HOY, -9)},OBS-0000001,Nota imprecisa,Pide más evidencia,`,
  ]);
  csv('valoracion_evidencias.csv', [
    'id_valoracion,id_evidencia,uso',
    'VAL-0000001,EVI-0000001,sustento_propuesta',
  ]);
}

jest.setTimeout(60_000);

describe('API de registro (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dirDataset: string;
  const almacenamiento = {
    firmarSubida: jest.fn(),
    firmarLectura: jest.fn(),
    comprobarBucket: jest.fn(),
    inspeccionar: jest.fn(),
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
      conteos: {
        jardines: 2,
        salas: 3,
        ninos: 3,
        descriptores: 48,
        manifestaciones: 96,
        evidencias: 2,
        valoraciones: 2,
      },
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
      expect(() => leerDataset(join(dirDataset, 'no-existe'))).toThrow(
        /no contiene: niveles_educativos.csv, .*jardines.csv/,
      );
      const roto = mkdtempSync(join(tmpdir(), 'dataset-roto-'));
      escribirFixture(roto);
      writeFileSync(
        join(roto, 'jardines.csv'),
        'id_jardin,nombre_fantasia,comuna,region,numero_salas,numero_educadoras,numero_asistentes,id_directora\nJAR-1,X,Y,Z,99,1,0,\n',
      );
      expect(() => leerDataset(roto)).toThrow(/jardines.csv, fila 2/);
      rmSync(roto, { recursive: true, force: true });
    });

    it('rechaza un fragmento que no está literalmente en la observación o una FK rota', () => {
      const roto = mkdtempSync(join(tmpdir(), 'dataset-roto-'));
      escribirFixture(roto);
      writeFileSync(
        join(roto, 'observacion_manifestaciones.csv'),
        `id_evidencia,id_observacion,id_manifestacion,fragmento_evidencia,alcance\nEVI-0000001,OBS-0000001,${man('SC', 'IA', 3)},Se calzó sola,componente_observado\nEVI-0000002,OBS-0000009,${man('SC', 'IA', 2)},x,componente_observado\n`,
      );
      expect(() => leerDataset(roto)).toThrow(/EVI-0000001: el fragmento no está literalmente/);
      expect(() => leerDataset(roto)).toThrow(/EVI-0000002: id_observacion OBS-0000009 no existe/);
      rmSync(roto, { recursive: true, force: true });
    });

    it('conserva IDs, fechas, nombres ficticios, la nota vacía como null y las valoraciones', async () => {
      const nino = await prisma.nino.findUniqueOrThrow({ where: { id: 'NINO-00001' } });
      expect(nino).toMatchObject({
        nombreCompleto: 'Sofía Prueba 001',
        idSala: 'JAR-0001-SC-01',
        idNivelEducativo: 'SC',
      });
      const obs = await prisma.observacion.findUniqueOrThrow({ where: { id: 'OBS-0000001' } });
      expect(obs).toMatchObject({
        notaBreve: null,
        textoObservacion: 'Se puso los zapatos sola y sonrió.',
        origen: 'dataset',
        idEducadora: 'EDU-0001',
      });
      const jardin = await prisma.jardin.findUniqueOrThrow({ where: { id: 'JAR-0002' } });
      expect(jardin).toMatchObject({ nombreFantasia: 'Jardín de Prueba, Dos', idDirectora: null });
      await expect(
        prisma.valoracion.findUniqueOrThrow({ where: { id: 'VAL-0000002' } }),
      ).resolves.toMatchObject({
        estado: 'evidencia_insuficiente',
        nivelSugerido: null,
        nivelValidado: null,
        idObservacionSinClasificar: 'OBS-0000001',
      });
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
      expect(todos.body.find((n: { id: string }) => n.id === 'NINO-00001')).toMatchObject({
        edadMeses: expect.any(Number),
        nombres: 'Sofía',
        apellidos: 'Prueba 001',
        nombreCompleto: 'Sofía Prueba 001',
        sala: 'SC-01',
        idSala: 'JAR-0001-SC-01',
        nivelEducativo: 'SC',
      });
      const sala = await http().get('/ninos?sala=NM-01').expect(200);
      expect(sala.body.map((n: { id: string }) => n.id)).toEqual(['NINO-00002']);
      const otro = await http().get('/ninos').set('Authorization', EDUCADORA_J2).expect(200);
      expect(otro.body.map((n: { id: string }) => n.id)).toEqual(['NINO-00003']);
    });

    it('catálogo de manifestaciones filtrable por núcleo, nivel educativo y nivel', async () => {
      const res = await http()
        .get('/manifestaciones?nivel=7&nucleo=CM&nivelEducativo=SC')
        .expect(200);
      expect(res.body).toEqual([
        {
          id: man('SC', 'CM', 7),
          idDescriptor: 'RUB-T-SC-CM-07',
          nucleo: 'CM',
          nivelEducativo: 'SC',
          nivel: 7,
          tipo: 'conducta_descriptor',
          textoObservable: 'Conducta CM 7.',
        },
        expect.objectContaining({ id: man('SC', 'CM', 7, 'E1'), tipo: 'ejemplo_ilustrativo' }),
      ]);
      const ia = await http().get('/manifestaciones?nucleo=IA&nivelEducativo=SC').expect(200);
      expect(ia.body).toHaveLength(16);
      await http().get('/manifestaciones?nivel=9').expect(400);
      await http().get('/manifestaciones?nivelEducativo=XX').expect(400);
    });
  });

  it('niveles de la trayectoria sin edades y catálogo de núcleos', async () => {
    const niveles = await http().get('/niveles').expect(200);
    expect(niveles.body).toHaveLength(8);
    expect(niveles.body[6]).toEqual({ nivel: 7, nombre: 'Nivel 7' });
    const nucleos = await http().get('/nucleos').expect(200);
    expect(nucleos.body.map((n: { id: string }) => n.id)).toEqual(['CM', 'IA', 'LV']);
    expect(nucleos.body.find((n: { id: string }) => n.id === 'IA')).toEqual({
      id: 'IA',
      nombre: 'Identidad y Autonomía',
      ambito: 'Desarrollo Personal y Social',
      origen: 'referencia_aportada_usuario',
    });
  });

  describe('trayectoria', () => {
    it('por núcleo, con valoraciones, «sin registros» y evidencia limitada', async () => {
      const res = await http().get('/ninos/NINO-00001/trayectoria').expect(200);
      expect(res.body).toMatchObject({
        totalObservaciones: 1,
        evidenciaLimitada: true,
        hasta: HOY,
      });
      expect(res.body.nucleos).toEqual([
        {
          nucleo: 'CM',
          sinRegistros: true,
          // Sin nivel sugerido ni validado: no se muestra como un nivel bajo.
          valoraciones: [
            {
              id: 'VAL-0000002',
              fechaCorte: sumarDias(HOY, -9),
              nivelSugerido: null,
              nivelValidado: null,
              estado: 'evidencia_insuficiente',
              origen: 'dataset',
            },
          ],
        },
        {
          nucleo: 'IA',
          sinRegistros: false,
          valoraciones: [
            {
              id: 'VAL-0000001',
              fechaCorte: sumarDias(HOY, -9),
              nivelSugerido: 3,
              nivelValidado: 3,
              estado: 'confirmada',
              origen: 'dataset',
            },
          ],
        },
        { nucleo: 'LV', sinRegistros: true, valoraciones: [] },
      ]);
      const manifestacion = {
        id: man('SC', 'IA', 3),
        idDescriptor: 'RUB-T-SC-IA-03',
        nucleo: 'IA',
        nivelEducativo: 'SC',
        nivel: 3,
        tipo: 'conducta_descriptor',
        textoObservable: 'Conducta IA 3.',
      };
      expect(res.body.observaciones).toEqual([
        {
          id: 'OBS-0000001',
          fecha: sumarDias(HOY, -10),
          formato: 'texto',
          origen: 'dataset',
          notaBreve: null,
          textoObservacion: 'Se puso los zapatos sola y sonrió.',
          manifestaciones: [manifestacion],
          evidencias: [
            {
              id: 'EVI-0000001',
              manifestacion,
              fragmento: 'Se puso los zapatos sola',
              alcance: 'componente_observado',
            },
          ],
        },
      ]);

      const amplio = await http()
        .get(`/ninos/NINO-00001/trayectoria?desde=${sumarDias(HOY, -500)}`)
        .expect(200);
      expect(amplio.body.totalObservaciones).toBe(2);
      // De la más reciente a la más antigua.
      expect(amplio.body.observaciones.map((o: { id: string }) => o.id)).toEqual([
        'OBS-0000001',
        'OBS-0000002',
      ]);
    });

    it('403 para otro jardín y 404 si no existe', async () => {
      await http().get('/ninos/NINO-00003/trayectoria').expect(403);
      await http().get('/ninos/NINO-99999/trayectoria').expect(404);
    });
  });

  describe('estado de salas y vista general (panel-directora-y-aprendizaje)', () => {
    it('estado por núcleo de una sala con el nivel validado vigente', async () => {
      const res = await http().get('/salas/estado?sala=SC-01').expect(200);
      expect(res.body).toMatchObject({ sala: 'SC-01', nivelEducativo: 'SC', matriculados: 1 });
      expect(res.body.niveles).toEqual([
        { idNino: 'NINO-00001', nucleo: 'IA', nivel: 3, fechaCorte: sumarDias(HOY, -9) },
      ]);
      const ia = res.body.nucleos.find((n: { nucleo: string }) => n.nucleo === 'IA');
      expect(ia).toMatchObject({ conDecision: 1, sinDecision: 0, mediana: 3, modas: [3] });
      // Evidencia insuficiente no es una decisión: cuenta como sin decisión.
      const cm = res.body.nucleos.find((n: { nucleo: string }) => n.nucleo === 'CM');
      expect(cm).toMatchObject({ conDecision: 0, sinDecision: 1, mediana: null });
      expect(res.body.alertas).toEqual([]);
    });

    it('una sala que no es del jardín responde 404', async () => {
      await http().get('/salas/estado?sala=TR-09').expect(404);
      await http().get('/salas/estado').expect(400);
    });

    it('el resumen del jardín es solo para la directora', async () => {
      await http().get('/jardin/resumen').expect(403);
      const res = await http().get('/jardin/resumen').set('Authorization', DIRECTORA).expect(200);
      expect(res.body.salas.map((s: { sala: string }) => s.sala)).toEqual(['NM-01', 'SC-01']);
      expect(res.body.salas[1]).toMatchObject({ matriculados: 1, alertasIndividuales: 0 });
      expect(res.body.reglas).toMatchObject({ paresMinimos: 5, brechaIndividual: 2 });
    });

    it('cuentas: solo la directora, y sin Cognito responde 501', async () => {
      await http().get('/cuentas').expect(403);
      await http().get('/cuentas').set('Authorization', DIRECTORA).expect(501);
      await http()
        .post('/cuentas')
        .set('Authorization', DIRECTORA)
        .send({ email: 'x@example.com', nombre: 'X Y', grupo: 'educadora', idJardin: 'JAR-0002' })
        .expect(400);
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
          // Nivel de referencia: el último validado de NINO-00001 (IA, nivel 3).
          nivelSugerido: 3,
          evidenciaInsuficiente: false,
          proveedor: 'fake',
          manifestaciones: [
            {
              manifestacion: { id: man('SC', 'CM', 3), nucleo: 'CM', nivelEducativo: 'SC' },
              cita: 'Apiló cuatro bloques solo y aplaudió.',
            },
          ],
          procesamiento: {
            simulado: true,
            entrada: { formato: 'texto', tipoArchivo: null, claveS3: null },
            pasos: [{ paso: 'extraccion', estado: 'simulado' }],
          },
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

    describe('aviso de subida (audio y foto)', () => {
      async function crearArchivo(formato: 'audio' | 'foto', tipo: string) {
        const res = await http()
          .post('/capturas')
          .send({ idNino: 'NINO-00001', formato, archivo: { tipo, tamano: 50_000 } })
          .expect(201);
        return res.body.captura.id as string;
      }

      it('no procesa hasta que la web avisa la subida', async () => {
        const id = await crearArchivo('audio', 'audio/webm');
        await new Promise((r) => setTimeout(r, 200));
        const res = await http().get(`/capturas/${id}`).expect(200);
        expect(res.body).toMatchObject({ estado: 'procesando', borrador: null });
        await expect(prisma.captura.findUnique({ where: { id } })).resolves.toMatchObject({
          encoladaEn: null,
        });
      });

      it('409 si el archivo aún no está en S3, y la captura sigue procesando', async () => {
        const id = await crearArchivo('audio', 'audio/webm');
        almacenamiento.inspeccionar.mockResolvedValue(null);
        await http().post(`/capturas/${id}/subida`).expect(409);
        expect(almacenamiento.inspeccionar).toHaveBeenCalledWith(`capturas/${id}.webm`);
        const res = await http().get(`/capturas/${id}`).expect(200);
        expect(res.body.estado).toBe('procesando');
      });

      it('422 si el tipo en S3 no es el declarado', async () => {
        const id = await crearArchivo('foto', 'image/jpeg');
        almacenamiento.inspeccionar.mockResolvedValue({ tipo: 'image/png', bytes: 50_000 });
        await http().post(`/capturas/${id}/subida`).expect(422);
      });

      it('audio en S3: borrador con texto de ejemplo y transcripción no implementada', async () => {
        const id = await crearArchivo('audio', 'audio/webm');
        almacenamiento.inspeccionar.mockResolvedValue({ tipo: 'audio/webm', bytes: 48_213 });
        await http().post(`/capturas/${id}/subida`).expect(200);

        const captura = await esperarBorrador(id);
        expect(captura.estado).toBe('borrador_listo');
        expect(captura.borrador.procesamiento).toEqual({
          simulado: true,
          entrada: {
            formato: 'audio',
            tipoArchivo: 'audio/webm',
            bytes: 48_213,
            claveS3: `capturas/${id}.webm`,
          },
          pasos: [
            {
              paso: 'transcripcion',
              estado: 'no_implementado',
              detalle: expect.stringContaining('texto de ejemplo'),
            },
            { paso: 'extraccion', estado: 'simulado', detalle: expect.any(String) },
          ],
        });

        // Un segundo aviso no vuelve a procesar.
        almacenamiento.inspeccionar.mockClear();
        await http().post(`/capturas/${id}/subida`).expect(200);
        expect(almacenamiento.inspeccionar).not.toHaveBeenCalled();
      });

      it('foto en S3: lectura de la imagen no implementada', async () => {
        const id = await crearArchivo('foto', 'image/jpeg');
        almacenamiento.inspeccionar.mockResolvedValue({ tipo: 'image/jpeg', bytes: 50_000 });
        await http().post(`/capturas/${id}/subida`).expect(200);
        const captura = await esperarBorrador(id);
        expect(captura.borrador.procesamiento.pasos.map((p: { paso: string }) => p.paso)).toEqual([
          'lectura_imagen',
          'extraccion',
        ]);
      });

      it('422 para una captura de texto; 403 si la avisa otra educadora', async () => {
        const texto = await crearTexto();
        await http().post(`/capturas/${texto}/subida`).expect(422);
        const id = await crearArchivo('audio', 'audio/webm');
        await http()
          .post(`/capturas/${id}/subida`)
          .set('Authorization', OTRA_EDUCADORA)
          .expect(403);
        await http()
          .post(`/capturas/${id}/subida`)
          .set('Authorization', 'Bearer local:educadora:JAR-0002')
          .expect(404);
      });
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
          nivel: 3,
          manifestaciones: [
            { idManifestacion: man('SC', 'CM', 3), cita: 'Apiló cuatro bloques solo y aplaudió.' },
          ],
        })
        .expect(200);
      expect(res.body).toMatchObject({
        estado: 'confirmada',
        observacion: {
          id: `APP-${id}`,
          nivel: 3,
          nucleos: ['CM'],
          fecha: HOY,
          manifestaciones: [
            {
              manifestacion: { id: man('SC', 'CM', 3) },
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
        textoObservacion: 'Apiló cuatro bloques solo y aplaudió. Luego siguió jugando.',
      });
      // Una valoración de la app por núcleo, con la forma de las decisiones del dataset.
      await expect(
        prisma.valoracion.findMany({ where: { idCaptura: id }, include: { evidencias: true } }),
      ).resolves.toEqual([
        expect.objectContaining({
          id: `VAL-APP-${id}-CM`,
          idNino: 'NINO-00001',
          idSala: 'JAR-0001-SC-01',
          idNucleo: 'CM',
          idVersion: 'E1-TEST',
          nivelSugerido: 3,
          nivelValidado: 3,
          estado: 'confirmada',
          origen: 'app',
          idUsuarioDecide: 'local-educadora',
          evidencias: [expect.objectContaining({ uso: 'sustento_propuesta' })],
        }),
      ]);
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({ nivel: 3, manifestaciones: [{ idManifestacion: man('SC', 'CM', 3) }] })
        .expect(409);
      const lista = await http().get(`/capturas?mias=true&estado=confirmada`).expect(200);
      expect(lista.body.items.find((c: { id: string }) => c.id === id)).toMatchObject({
        nivel: 3,
        nucleos: ['CM'],
      });
      const trayectoria = await http().get('/ninos/NINO-00001/trayectoria').expect(200);
      const cm = trayectoria.body.nucleos.find((n: { nucleo: string }) => n.nucleo === 'CM');
      expect(cm.sinRegistros).toBe(false);
      expect(cm.valoraciones).toContainEqual(
        expect.objectContaining({ id: `VAL-APP-${id}-CM`, origen: 'app', nivelValidado: 3 }),
      );
    });

    it('corregir conserva la sugerencia original de la IA', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({
          nivel: 2,
          manifestaciones: [
            { idManifestacion: man('SC', 'IA', 2) },
            { idManifestacion: man('SC', 'CM', 2) },
          ],
        })
        .expect(200);
      const correccion = await prisma.correccion.findUniqueOrThrow({ where: { idCaptura: id } });
      expect(correccion).toMatchObject({
        decision: 'corregida',
        sugerencia: { nivel: 3, manifestaciones: [{ idManifestacion: man('SC', 'CM', 3) }] },
        final: { nivel: 2 },
      });
      await expect(prisma.borrador.findUnique({ where: { idCaptura: id } })).resolves.toMatchObject(
        { nivelSugerido: 3 },
      );
      // El borrador proponía CM (nivel 3) y no IA: ambas quedan ajustadas a 2.
      const valoraciones = await prisma.valoracion.findMany({
        where: { idCaptura: id },
        orderBy: { idNucleo: 'asc' },
      });
      expect(
        valoraciones.map((v) => [v.idNucleo, v.nivelSugerido, v.nivelValidado, v.estado]),
      ).toEqual([
        ['CM', 3, 2, 'ajustada'],
        ['IA', null, 2, 'ajustada'],
      ]);
    });

    it('422 si una manifestación no existe, no es del nivel elegido o es de otro nivel educativo; 400 si hay más de 5 o repetidas', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      const confirmar = (body: object) => http().post(`/capturas/${id}/confirmacion`).send(body);
      await confirmar({
        nivel: 3,
        manifestaciones: [{ idManifestacion: man('SC', 'CM', 2) }],
      }).expect(422);
      await confirmar({ nivel: 3, manifestaciones: [{ idManifestacion: 'MAN-NO-EXISTE' }] }).expect(
        422,
      );
      const otroNivelEducativo = await confirmar({
        nivel: 3,
        manifestaciones: [{ idManifestacion: man('NM', 'CM', 3) }],
      }).expect(422);
      expect(otroNivelEducativo.body.message).toMatch(/es de NM; el niño o niña está en SC/);
      await confirmar({
        nivel: 3,
        manifestaciones: [
          { idManifestacion: man('SC', 'CM', 3) },
          { idManifestacion: man('SC', 'CM', 3) },
        ],
      }).expect(400);
      await confirmar({ nivel: 3, manifestaciones: [] }).expect(400);
      await confirmar({
        nivel: 9,
        manifestaciones: [{ idManifestacion: man('SC', 'CM', 3) }],
      }).expect(400);
      await expect(prisma.valoracion.count({ where: { idCaptura: id } })).resolves.toBe(0);
    });

    it('solo quien registró decide; la directora y otras educadoras reciben 403', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      const body = { nivel: 3, manifestaciones: [{ idManifestacion: man('SC', 'CM', 3) }] };
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
        .send({ nivel: 3, manifestaciones: [{ idManifestacion: man('SC', 'CM', 3) }] })
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
      nivelSugerido: 3,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: man('SC', 'CM', 3), cita: 'Saltó en la rampa' }],
      proveedor: 'bedrock',
      modelo: 'us.anthropic.claude-sonnet-5-5',
    };

    it('audio: guarda la transcripción original y muestra y confirma las citas con el nombre real', async () => {
      const id = await capturaProcesando();
      await entregar(id, {
        ...valido,
        textoFuente: '{NAME} saltó en la rampa con los dos pies.',
        textoOriginal: 'Mateo saltó en la rampa con los dos pies.',
        manifestaciones: [
          { idManifestacion: man('SC', 'CM', 3), cita: '{NAME} saltó en la rampa' },
        ],
      }).expect(200);

      const detalle = (await http().get(`/capturas/${id}`).expect(200)).body;
      expect(detalle.texto).toBe('Mateo saltó en la rampa con los dos pies.');
      expect(detalle.borrador.textoFuente).toBe('{NAME} saltó en la rampa con los dos pies.');
      expect(detalle.borrador.manifestaciones[0].cita).toBe('Mateo saltó en la rampa');
      const lista = (await http().get('/capturas?estado=borrador_listo').expect(200)).body;
      expect(lista.items.find((c: { id: string }) => c.id === id).extracto).toContain('Mateo');

      // La web devuelve la cita tal como la mostró.
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({
          nivel: 3,
          manifestaciones: [
            { idManifestacion: man('SC', 'CM', 3), cita: 'Mateo saltó en la rampa' },
          ],
        })
        .expect(200);
      const observacion = await prisma.observacion.findUniqueOrThrow({
        where: { id: `APP-${id}` },
        include: { vinculos: true },
      });
      expect(observacion.textoObservacion).toBe('Mateo saltó en la rampa con los dos pies.');
      expect(observacion.vinculos.map((v) => v.cita)).toEqual(['Mateo saltó en la rampa']);
    });

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
      await entregar(id, { ...valido, nivelSugerido: 2, manifestaciones: [] }).expect(200);
      await expect(prisma.borrador.count({ where: { idCaptura: id } })).resolves.toBe(1);
      await expect(prisma.borrador.findUnique({ where: { idCaptura: id } })).resolves.toMatchObject(
        { nivelSugerido: 3 },
      );
      await expect(prisma.captura.findUnique({ where: { id } })).resolves.toMatchObject({
        estado: 'borrador_listo',
      });
    });

    it('422 si una cita no está en el texto, el nivel o el nivel educativo no calzan o la evidencia es contradictoria', async () => {
      const id = await capturaProcesando();
      await entregar(id, {
        ...valido,
        manifestaciones: [{ idManifestacion: man('SC', 'CM', 3), cita: 'inventada' }],
      }).expect(422);
      await entregar(id, { ...valido, nivelSugerido: 2 }).expect(422);
      await entregar(id, {
        ...valido,
        manifestaciones: [{ idManifestacion: man('NM', 'CM', 3), cita: 'Saltó en la rampa' }],
      }).expect(422);
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
        .send({ nivel: 3, manifestaciones: [{ idManifestacion: man('SC', 'CM', 3) }] })
        .expect(200);
      expect(res.body.estado).toBe('confirmada');
      await expect(
        prisma.correccion.findUnique({ where: { idCaptura: id } }),
      ).resolves.toMatchObject({
        decision: 'corregida',
        sugerencia: { nivel: null, manifestaciones: [] },
      });
    });

    it('sin borrador, la observación guarda el texto original de la captura', async () => {
      const original = 'Texto original sin anonimizar: Sofía apiló bloques.';
      const id = (
        await prisma.captura.create({
          data: {
            idNino: 'NINO-00001',
            idJardin: 'JAR-0001',
            idUsuario: 'local-educadora',
            autor: 'Educadora local',
            formato: 'texto',
            texto: original,
            fecha: new Date(`${HOY}T00:00:00Z`),
          },
        })
      ).id;
      await http()
        .post(`/interno/capturas/${id}/error`)
        .set('x-pipeline-token', TOKEN_PIPELINE)
        .send({ detalle: 'Guardrail no disponible' })
        .expect(200, { id, estado: 'error' });
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({ nivel: 3, manifestaciones: [{ idManifestacion: man('SC', 'CM', 3) }] })
        .expect(200);
      // La retención vacía `capturas.texto` a los 7 días; la observación lo conserva
      // (corregir-hallazgos-demo: la educadora ve los nombres reales).
      await expect(
        prisma.observacion.findUniqueOrThrow({ where: { id: `APP-${id}` } }),
      ).resolves.toMatchObject({ textoObservacion: original, notaBreve: original });
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

      const sala = await http().get(`/capturas?sala=NM-01&desde=${HOY}&hasta=${HOY}`).expect(200);
      expect(sala.body.total).toBe(0);
      const deOtroJardin = await http()
        .get('/capturas')
        .set('Authorization', EDUCADORA_J2)
        .expect(200);
      expect(deOtroJardin.body.total).toBe(0);

      const item = mias.body.items.find((c: { id: string }) => c.id === mia);
      expect(item).toMatchObject({
        estado: 'borrador_listo',
        nucleos: ['CM'],
        nivel: null,
        nino: { sala: 'SC-01', nivelEducativo: 'SC' },
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
      // Catálogo del nivel educativo, nivel de referencia y nada que identifique al niño o niña.
      // El nivel de referencia ya incluye las confirmaciones de la app de pruebas anteriores.
      expect(mensaje).toMatchObject({ nivelEducativo: 'SC', nivelEsperado: expect.any(Number) });
      expect(mensaje.catalogo).toHaveLength(48);
      expect(mensaje.catalogo.every((m) => m.nivelEducativo === 'SC')).toBe(true);
      expect(new Set(mensaje.catalogo.map((m) => m.nivel)).size).toBe(8);
      expect(JSON.stringify(mensaje)).not.toMatch(/NINO-|idNino|nombres|apellidos/);
      // Las decisiones de las pruebas anteriores (mismo jardín y nivel educativo) vuelven como
      // ejemplos, con las corregidas primero y solo manifestaciones del catálogo.
      expect(mensaje.ejemplos?.length).toBeGreaterThan(0);
      expect(mensaje.ejemplos![0]!.corregida).toBe(true);
      const ids = new Set(mensaje.catalogo.map((m) => m.id));
      expect(mensaje.ejemplos!.every((e) => e.idsManifestaciones.every((i) => ids.has(i)))).toBe(
        true,
      );
      expect(JSON.stringify(mensaje.ejemplos)).not.toMatch(/idCaptura|idUsuario|local-educadora/);
      await new Promise((r) => setTimeout(r, 200));
      await expect(prisma.captura.findUnique({ where: { id } })).resolves.toMatchObject({
        estado: 'procesando',
      });
    });

    it('sin decisiones en el jardín, el mensaje no trae ejemplos de otros jardines', async () => {
      await request(appCola.getHttpServer())
        .post('/capturas')
        .set('Authorization', EDUCADORA_J2)
        .send({ idNino: 'NINO-00003', formato: 'texto', texto: 'Nota de otro jardín.' })
        .expect(201);
      const mensaje = MensajeCapturaSchema.parse(cola.enviar.mock.calls.at(-1)![0]);
      expect(mensaje.idJardin).toBe('JAR-0002');
      expect(mensaje.ejemplos).toEqual([]);
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
      almacenamiento.inspeccionar.mockResolvedValue({ tipo: 'audio/webm', bytes: 50_000 });
      await request(appCola.getHttpServer()).post(`/capturas/${id}/subida`).expect(200);
      await request(appCola.getHttpServer()).post(`/capturas/${id}/subida`).expect(200);
      expect(cola.enviar).toHaveBeenCalledTimes(1);
      expect(cola.enviar.mock.calls[0]![0]).toMatchObject({
        idCaptura: id,
        formato: 'audio',
        archivoClave: `capturas/${id}.webm`,
        archivoTipo: 'audio/webm',
        archivoBytes: 50_000,
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

  describe('retención y borrado (endurecer-seguridad-aws)', () => {
    const HACE_8_DIAS = () => new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    it('a los 7 días vacía el texto original y el archivo, y conserva el texto anonimizado', async () => {
      const vieja = await crearTexto('Nota antigua: apiló cuatro bloques solo.');
      await esperarBorrador(vieja);
      const audio = await http()
        .post('/capturas')
        .send({
          idNino: 'NINO-00001',
          formato: 'audio',
          archivo: { tipo: 'audio/webm', tamano: 50_000 },
        })
        .expect(201);
      const idAudio = audio.body.captura.id as string;
      const reciente = await crearTexto('Nota reciente con bloques.');
      await prisma.captura.updateMany({
        where: { id: { in: [vieja, idAudio] } },
        data: { creadoEn: HACE_8_DIAS() },
      });

      const retencion = app.get(RetencionService);
      await expect(retencion.purgar()).resolves.toBe(2);

      const detalle = (await http().get(`/capturas/${vieja}`).expect(200)).body;
      expect(detalle.texto).toBeNull();
      expect(detalle.borrador.textoFuente).toContain('bloques');
      const deAudio = (await http().get(`/capturas/${idAudio}`).expect(200)).body;
      expect(deAudio.tieneArchivo).toBe(false);
      await http().get(`/capturas/${idAudio}/archivo`).expect(404);
      const deReciente = (await http().get(`/capturas/${reciente}`).expect(200)).body;
      expect(deReciente.texto).toBe('Nota reciente con bloques.');
      // Idempotente: una segunda pasada no encuentra nada.
      await expect(retencion.purgar()).resolves.toBe(0);
    });

    it('borrar una captura confirmada borra borrador, corrección y eventos, y conserva la observación', async () => {
      const id = await crearTexto();
      await esperarBorrador(id);
      await http()
        .post(`/capturas/${id}/confirmacion`)
        .send({
          nivel: 3,
          manifestaciones: [
            { idManifestacion: man('SC', 'CM', 3), cita: 'Apiló cuatro bloques solo y aplaudió.' },
          ],
        })
        .expect(200);

      await prisma.captura.delete({ where: { id } });

      await expect(prisma.borrador.count({ where: { idCaptura: id } })).resolves.toBe(0);
      await expect(prisma.correccion.count({ where: { idCaptura: id } })).resolves.toBe(0);
      await expect(prisma.eventoTiempo.count({ where: { idCaptura: id } })).resolves.toBe(0);
      await expect(
        prisma.observacion.findUnique({ where: { id: `APP-${id}` } }),
      ).resolves.toMatchObject({ idCaptura: null });
      // La valoración confirmada también se conserva, sin la referencia a la captura.
      await expect(
        prisma.valoracion.findUnique({ where: { id: `VAL-APP-${id}-CM` } }),
      ).resolves.toMatchObject({ idCaptura: null, nivelValidado: 3 });
    });
  });
});
