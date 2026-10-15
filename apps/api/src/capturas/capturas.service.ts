import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';
import { ProcesamientoSchema } from '@toqui/shared';
import type {
  ArchivoResponse,
  BorradorEntrante,
  CapturaDetalle,
  CapturaResumen,
  ContextoCaptura,
  ConfirmacionRequest,
  CrearCapturaRequest,
  CrearCapturaResponse,
  Dominio,
  EstadoCaptura,
  ListarCapturasQuery,
  ListarCapturasResponse,
  Manifestacion,
} from '@toqui/shared';
import { autorDe, type Identidad } from '../auth/identidad';
import { AlmacenamientoService } from '../aws/almacenamiento.service';
import { CatalogoService } from '../catalogo/catalogo.service';
import { aColumnaFecha, desdeColumnaFecha, edadEnMeses, hoyEn } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Manifestaciones guardadas en `borradores.manifestaciones` y en `correcciones`. */
const CitasSchema = z.array(z.object({ idManifestacion: z.string(), cita: z.string().nullable() }));
type Citas = z.infer<typeof CitasSchema>;

const INCLUIR = {
  nino: { select: { id: true, nombres: true, apellidos: true, salaGrupo: true } },
  borrador: true,
  observacion: {
    include: {
      vinculos: { include: { manifestacion: true }, orderBy: { idManifestacion: 'asc' } },
    },
  },
} satisfies Prisma.CapturaInclude;

type CapturaCompleta = Prisma.CapturaGetPayload<{ include: typeof INCLUIR }>;

/** Archivo de una captura ya comprobado en S3. */
export interface ArchivoSubido {
  clave: string;
  tipo: string;
  bytes: number;
}

/** Estados desde los que la educadora puede confirmar o descartar. */
const DECIDIBLES: EstadoCaptura[] = ['borrador_listo', 'error'];
const LARGO_EXTRACTO = 140;

@Injectable()
export class CapturasService {
  private readonly logger = new Logger(CapturasService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly catalogo: CatalogoService,
  ) {}

  /**
   * Crea la captura en `procesando`. Audio y foto devuelven el PUT firmado: el pipeline se
   * dispara cuando el archivo llega a S3. En modo `aws`, el texto se guarda en S3 por el mismo motivo.
   */
  async crear(
    identidad: Identidad,
    datos: CrearCapturaRequest,
  ): Promise<{ id: string; subida: CrearCapturaResponse['subida'] }> {
    const nino = await this.catalogo.ninoDelJardin(identidad, datos.idNino);
    const id = randomUUID();

    // Firmar antes de insertar: si S3 no está configurado no queda una captura huérfana.
    const firmada = datos.archivo
      ? await this.almacenamiento.firmarSubida(id, datos.archivo.tipo, datos.archivo.tamano)
      : null;

    await this.prisma.captura.create({
      data: {
        id,
        idNino: nino.id,
        idJardin: nino.idJardin,
        idUsuario: identidad.id,
        autor: autorDe(identidad),
        formato: datos.formato,
        texto: datos.texto ?? null,
        archivoClave: firmada?.clave ?? null,
        archivoTipo: datos.archivo?.tipo ?? null,
        fecha: aColumnaFecha(hoyEn(this.env.ZONA_HORARIA)),
        eventos: { create: { tipo: 'inicio' } },
      },
    });

    if (datos.formato === 'texto' && this.env.PIPELINE_MODE === 'aws') {
      try {
        await this.almacenamiento.guardarTexto(id, datos.texto!);
      } catch (error) {
        this.logger.error(`No se pudo enviar ${id} al pipeline`, error as Error);
        await this.marcarError(id, 'No se pudo enviar la captura al pipeline');
        throw new ServiceUnavailableException(
          'No se pudo enviar la nota a procesar; intente de nuevo',
        );
      }
    }
    return { id, subida: firmada?.subida ?? null };
  }

  async detalle(identidad: Identidad, id: string): Promise<CapturaDetalle> {
    return this.aDetalle(await this.buscar(identidad, id));
  }

  async listar(identidad: Identidad, q: ListarCapturasQuery): Promise<ListarCapturasResponse> {
    const where: Prisma.CapturaWhereInput = {
      idJardin: identidad.idJardin,
      ...((q.desde || q.hasta) && {
        fecha: {
          ...(q.desde && { gte: aColumnaFecha(q.desde) }),
          ...(q.hasta && { lte: aColumnaFecha(q.hasta) }),
        },
      }),
      ...(q.sala && { nino: { salaGrupo: q.sala } }),
      ...(q.idNino && { idNino: q.idNino }),
      ...(q.estado && { estado: q.estado }),
      ...(q.mias && { idUsuario: identidad.id }),
    };
    const [total, filas] = await this.prisma.$transaction([
      this.prisma.captura.count({ where }),
      this.prisma.captura.findMany({
        where,
        include: INCLUIR,
        orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
        skip: (q.pagina - 1) * q.tamano,
        take: q.tamano,
      }),
    ]);
    const catalogo = await this.manifestacionesDe(filas.flatMap((c) => this.citasBorrador(c)));
    return {
      items: filas.map((c) => this.aResumen(c, catalogo)),
      total,
      pagina: q.pagina,
      tamano: q.tamano,
    };
  }

  /**
   * La educadora que registró confirma el borrador tal cual o corregido. Se guarda la
   * observación confirmada y la corrección (sugerencia frente a decisión).
   */
  async confirmar(
    identidad: Identidad,
    id: string,
    decision: ConfirmacionRequest,
  ): Promise<CapturaDetalle> {
    const captura = await this.buscarPropia(identidad, id);
    const catalogo = await this.manifestacionesDe(
      decision.manifestaciones.map((m) => m.idManifestacion),
    );
    for (const m of decision.manifestaciones) {
      const encontrada = catalogo.get(m.idManifestacion);
      if (!encontrada)
        throw new UnprocessableEntityException(`Manifestación ${m.idManifestacion} inexistente`);
      if (encontrada.nivel !== decision.nivel) {
        throw new UnprocessableEntityException(
          `La manifestación ${m.idManifestacion} no corresponde al nivel ${decision.nivel}`,
        );
      }
    }

    const sugerencia = this.sugerenciaDe(captura);
    const final = {
      nivel: decision.nivel,
      manifestaciones: decision.manifestaciones.map((m) => ({
        idManifestacion: m.idManifestacion,
        cita: m.cita ?? null,
      })),
    };
    const sinCambios =
      sugerencia.nivel === final.nivel &&
      mismoConjunto(sugerencia.manifestaciones, final.manifestaciones);

    await this.prisma.$transaction(async (tx) => {
      await this.tomarDecision(tx, id, 'confirmada');
      await tx.observacion.create({
        data: {
          id: `APP-${id}`,
          idNino: captura.idNino,
          idUsuario: identidad.id,
          fechaObservacion: captura.fecha,
          formatoCaptura: captura.formato,
          nivelEstimado: decision.nivel,
          notaBreve: captura.texto?.slice(0, 280) ?? null,
          origen: 'app',
          idCaptura: id,
          vinculos: { create: final.manifestaciones },
        },
      });
      await tx.correccion.create({
        data: {
          idCaptura: id,
          idUsuario: identidad.id,
          decision: sinCambios ? 'confirmada' : 'corregida',
          sugerencia,
          final,
        },
      });
      await tx.eventoTiempo.create({ data: { idCaptura: id, tipo: 'confirmacion' } });
    });
    return this.detalle(identidad, id);
  }

  /** La educadora descarta el borrador: no se crea observación y queda registrado el descarte. */
  async descartar(identidad: Identidad, id: string): Promise<CapturaDetalle> {
    const captura = await this.buscarPropia(identidad, id);
    await this.prisma.$transaction(async (tx) => {
      await this.tomarDecision(tx, id, 'descartada');
      await tx.correccion.create({
        data: {
          idCaptura: id,
          idUsuario: identidad.id,
          decision: 'descartada',
          sugerencia: this.sugerenciaDe(captura),
          final: Prisma.DbNull,
        },
      });
      await tx.eventoTiempo.create({ data: { idCaptura: id, tipo: 'descarte' } });
    });
    return this.detalle(identidad, id);
  }

  async archivo(identidad: Identidad, id: string): Promise<ArchivoResponse> {
    const captura = await this.buscar(identidad, id);
    if (!captura.archivoClave) throw new NotFoundException('La captura no tiene archivo');
    const firmada = await this.almacenamiento.firmarLectura(captura.archivoClave);
    return { ...firmada, tipo: captura.archivoTipo ?? 'application/octet-stream' };
  }

  /**
   * La web avisa que subió el archivo. Comprueba que el objeto está en S3 con el tipo declarado
   * y dice si hay que procesar: no, si la captura ya tiene borrador o dejó de estar procesando.
   * 409 si el objeto aún no llega; 422 si la captura no tiene archivo o el tipo no coincide.
   */
  async verificarSubida(
    identidad: Identidad,
    id: string,
  ): Promise<{ procesar: false } | { procesar: true; archivo: ArchivoSubido }> {
    const captura = await this.buscarPropia(identidad, id);
    if (!captura.archivoClave || !captura.archivoTipo) {
      throw new UnprocessableEntityException('La captura no tiene archivo');
    }
    if (captura.estado !== 'procesando' || captura.borrador) return { procesar: false };
    const objeto = await this.almacenamiento.inspeccionar(captura.archivoClave);
    if (!objeto) throw new ConflictException('El archivo aún no está en S3');
    if (objeto.tipo.split(';')[0] !== captura.archivoTipo) {
      throw new UnprocessableEntityException(
        `El archivo en S3 es ${objeto.tipo}, no ${captura.archivoTipo}`,
      );
    }
    return {
      procesar: true,
      archivo: { clave: captura.archivoClave, tipo: captura.archivoTipo, bytes: objeto.bytes },
    };
  }

  /**
   * Recibe el borrador del pipeline. Idempotente por captura: si ya hay uno, no cambia nada
   * (los reintentos de Step Functions no duplican borradores).
   */
  async registrarBorrador(
    id: string,
    b: BorradorEntrante,
  ): Promise<{ id: string; estado: EstadoCaptura }> {
    const captura = await this.prisma.captura.findUnique({
      where: { id: this.uuid(id) },
      select: { estado: true, borrador: { select: { id: true } } },
    });
    if (!captura) throw new NotFoundException('Captura no encontrada');
    if (captura.borrador) return { id, estado: captura.estado };
    if (captura.estado !== 'procesando' && captura.estado !== 'error') {
      throw new ConflictException(`La captura ya está ${captura.estado}`);
    }
    await this.validarBorrador(b);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.borrador.create({
          data: {
            idCaptura: id,
            textoFuente: b.textoFuente,
            nivelSugerido: b.nivelSugerido,
            evidenciaInsuficiente: b.evidenciaInsuficiente,
            manifestaciones: b.manifestaciones,
            proveedor: b.proveedor,
            modelo: b.modelo ?? null,
            procesamiento: b.procesamiento ?? Prisma.DbNull,
          },
        });
        await tx.captura.update({
          where: { id },
          data: { estado: 'borrador_listo', errorDetalle: null },
        });
        await tx.eventoTiempo.create({ data: { idCaptura: id, tipo: 'borrador_listo' } });
      });
    } catch (error) {
      // Dos entregas simultáneas: la segunda choca con la restricción única y se ignora.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
        throw error;
    }
    const actual = await this.prisma.captura.findUniqueOrThrow({
      where: { id },
      select: { estado: true },
    });
    return { id, estado: actual.estado };
  }

  /**
   * Contexto para el pipeline: edad a la fecha de la captura, nivel esperado (mismo criterio que
   * el pipeline inline) y catálogo de los niveles esperado ±1. Sin datos identificables.
   */
  async contexto(id: string): Promise<ContextoCaptura> {
    const captura = await this.prisma.captura.findUnique({
      where: { id: this.uuid(id) },
      select: {
        formato: true,
        estado: true,
        texto: true,
        fecha: true,
        nino: { select: { fechaNacimiento: true } },
      },
    });
    if (!captura) throw new NotFoundException('Captura no encontrada');
    const edadMeses = Math.max(
      0,
      edadEnMeses(
        desdeColumnaFecha(captura.nino.fechaNacimiento),
        desdeColumnaFecha(captura.fecha),
      ),
    );
    const niveles = await this.prisma.nivel.findMany({ orderBy: { nivel: 'asc' } });
    const nivelEsperado =
      niveles.find((n) => edadMeses >= n.edadMinMeses && edadMeses < n.edadMaxMeses)?.nivel ??
      niveles.at(-1)?.nivel ??
      1;
    const catalogo = await this.prisma.manifestacion.findMany({
      where: { nivel: { gte: nivelEsperado - 1, lte: nivelEsperado + 1 } },
      select: { id: true, nivel: true, dominio: true, textoObservable: true },
      orderBy: { id: 'asc' },
    });
    const formato = captura.formato === 'video' ? 'audio' : captura.formato;
    return {
      id,
      formato,
      estado: captura.estado,
      texto: formato === 'texto' ? captura.texto : null,
      edadMeses,
      nivelEsperado,
      catalogo,
    };
  }

  /** El pipeline informa que no pudo procesar la captura. */
  async registrarErrorPipeline(
    id: string,
    detalle: string,
  ): Promise<{ id: string; estado: EstadoCaptura }> {
    const existe = await this.prisma.captura.findUnique({
      where: { id: this.uuid(id) },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Captura no encontrada');
    await this.marcarError(id, detalle);
    const actual = await this.prisma.captura.findUniqueOrThrow({
      where: { id },
      select: { estado: true },
    });
    return { id, estado: actual.estado };
  }

  /** Solo pasa a error una captura que sigue procesando. */
  private async marcarError(id: string, detalle: string): Promise<void> {
    await this.prisma.captura.updateMany({
      where: { id, estado: 'procesando' },
      data: { estado: 'error', errorDetalle: detalle },
    });
  }

  /**
   * Valida lo que dice D7 sobre el borrador: manifestaciones existentes y del nivel sugerido,
   * y cada cita presente literalmente en el texto.
   */
  private async validarBorrador(b: BorradorEntrante): Promise<void> {
    const problemas: string[] = [];
    if (b.evidenciaInsuficiente) {
      if (b.manifestaciones.length > 0)
        problemas.push('con evidencia insuficiente no se proponen manifestaciones');
    } else {
      if (b.nivelSugerido === null) problemas.push('falta el nivel sugerido');
      if (b.manifestaciones.length === 0) problemas.push('faltan manifestaciones');
    }
    const catalogo = await this.manifestacionesDe(b.manifestaciones.map((m) => m.idManifestacion));
    for (const m of b.manifestaciones) {
      const encontrada = catalogo.get(m.idManifestacion);
      if (!encontrada) problemas.push(`${m.idManifestacion} no existe`);
      else if (encontrada.nivel !== b.nivelSugerido)
        problemas.push(`${m.idManifestacion} no es del nivel sugerido`);
      if (!b.textoFuente.includes(m.cita))
        problemas.push(`la cita de ${m.idManifestacion} no está en el texto`);
    }
    if (problemas.length)
      throw new UnprocessableEntityException(`Borrador inválido: ${problemas.join('; ')}`);
  }

  /** Pasa la captura a su estado final; 409 si ya se decidió o aún no tiene borrador. */
  private async tomarDecision(
    tx: Prisma.TransactionClient,
    id: string,
    estado: 'confirmada' | 'descartada',
  ): Promise<void> {
    const { count } = await tx.captura.updateMany({
      where: { id, estado: { in: DECIDIBLES } },
      data: { estado },
    });
    if (count === 0) {
      const actual = await tx.captura.findUniqueOrThrow({
        where: { id },
        select: { estado: true },
      });
      throw new ConflictException(
        actual.estado === 'procesando'
          ? 'La captura aún no tiene borrador'
          : `La captura ya está ${actual.estado}`,
      );
    }
  }

  private uuid(id: string): string {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException('Captura no encontrada');
    return id;
  }

  /** Captura del jardín de la persona; las de otros jardines se tratan como inexistentes. */
  private async buscar(identidad: Identidad, id: string): Promise<CapturaCompleta> {
    const captura = await this.prisma.captura.findFirst({
      where: { id: this.uuid(id), idJardin: identidad.idJardin },
      include: INCLUIR,
    });
    if (!captura) throw new NotFoundException('Captura no encontrada');
    return captura;
  }

  /** Solo quien registró la captura decide sobre su borrador. */
  private async buscarPropia(identidad: Identidad, id: string): Promise<CapturaCompleta> {
    const captura = await this.buscar(identidad, id);
    if (captura.idUsuario !== identidad.id) {
      throw new ForbiddenException(
        'Solo quien registró la captura puede confirmarla o descartarla',
      );
    }
    return captura;
  }

  private citasBorrador(c: { borrador: { manifestaciones: Prisma.JsonValue } | null }): string[] {
    return c.borrador
      ? CitasSchema.parse(c.borrador.manifestaciones).map((m) => m.idManifestacion)
      : [];
  }

  private sugerenciaDe(c: CapturaCompleta): { nivel: number | null; manifestaciones: Citas } {
    return {
      nivel: c.borrador?.nivelSugerido ?? null,
      manifestaciones: c.borrador ? CitasSchema.parse(c.borrador.manifestaciones) : [],
    };
  }

  private async manifestacionesDe(ids: string[]): Promise<Map<string, Manifestacion>> {
    if (ids.length === 0) return new Map();
    const filas = await this.prisma.manifestacion.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, nivel: true, dominio: true, textoObservable: true },
    });
    return new Map(filas.map((m) => [m.id, m]));
  }

  private async aDetalle(c: CapturaCompleta): Promise<CapturaDetalle> {
    const catalogo = await this.manifestacionesDe(this.citasBorrador(c));
    const borrador = c.borrador && {
      textoFuente: c.borrador.textoFuente,
      nivelSugerido: c.borrador.nivelSugerido,
      evidenciaInsuficiente: c.borrador.evidenciaInsuficiente,
      proveedor: c.borrador.proveedor,
      procesamiento: ProcesamientoSchema.nullable().catch(null).parse(c.borrador.procesamiento),
      manifestaciones: CitasSchema.parse(c.borrador.manifestaciones).flatMap((m) => {
        const manifestacion = catalogo.get(m.idManifestacion);
        return manifestacion ? [{ manifestacion, cita: m.cita }] : [];
      }),
    };
    const observacion = c.observacion && {
      id: c.observacion.id,
      fecha: desdeColumnaFecha(c.observacion.fechaObservacion),
      nivelEstimado: c.observacion.nivelEstimado,
      manifestaciones: c.observacion.vinculos.map((v) => ({
        manifestacion: {
          id: v.manifestacion.id,
          nivel: v.manifestacion.nivel,
          dominio: v.manifestacion.dominio,
          textoObservable: v.manifestacion.textoObservable,
        },
        cita: v.cita,
      })),
    };
    return {
      ...this.base(c),
      texto: c.texto,
      tieneArchivo: c.archivoClave !== null,
      errorDetalle: c.errorDetalle,
      borrador,
      observacion,
    };
  }

  private aResumen(c: CapturaCompleta, catalogo: Map<string, Manifestacion>): CapturaResumen {
    const dominios: Dominio[] = c.observacion
      ? c.observacion.vinculos.map((v) => v.manifestacion.dominio)
      : this.citasBorrador(c).flatMap((id) => {
          const m = catalogo.get(id);
          return m ? [m.dominio] : [];
        });
    const texto = c.texto ?? c.borrador?.textoFuente ?? null;
    return {
      ...this.base(c),
      extracto: texto ? texto.slice(0, LARGO_EXTRACTO) : null,
      dominios: [...new Set(dominios)],
      nivel: c.observacion?.nivelEstimado ?? null,
    };
  }

  private base(c: CapturaCompleta) {
    return {
      id: c.id,
      nino: {
        id: c.nino.id,
        nombres: c.nino.nombres,
        apellidos: c.nino.apellidos,
        sala: c.nino.salaGrupo,
      },
      autor: c.autor,
      formato: c.formato as CapturaDetalle['formato'],
      estado: c.estado,
      creadoEn: c.creadoEn.toISOString(),
    };
  }
}

/** Mismo conjunto de manifestaciones, sin importar el orden ni las citas. */
function mismoConjunto(a: Citas, b: Citas): boolean {
  const ids = (l: Citas) =>
    l
      .map((m) => m.idManifestacion)
      .sort()
      .join('|');
  return ids(a) === ids(b);
}
