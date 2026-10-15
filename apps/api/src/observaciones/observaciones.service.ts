import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  TIPOS_ARCHIVO,
  type ArchivoResponse,
  type CrearObservacionRequest,
  type CrearObservacionResponse,
  type MiDiaResponse,
  type ObservacionDetalle,
  type ObservacionResumen,
} from '@toqui/shared';
import type { Identidad } from '../auth/identidad';
import { AlmacenamientoService } from '../aws/almacenamiento.service';
import { ColaService } from '../aws/cola.service';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { CriteriosService } from '../criterios/criterios.service';
import type { EstadoObservacion, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { aColumnaFecha, desdeColumnaFecha, hoyEn } from './fechas';

export const INCLUIR_RELACIONES = {
  usuario: { select: { id: true, nombre: true } },
  criterio: { select: { id: true, nombre: true } },
  criterioPropuesto: { select: { id: true, nombre: true } },
} satisfies Prisma.ObservacionInclude;

export type ObservacionConRelaciones = Prisma.ObservacionGetPayload<{
  include: typeof INCLUIR_RELACIONES;
}>;

/** Estados desde los que el registrador puede confirmar o corregir. */
const REVISABLES_REGISTRADOR: EstadoObservacion[] = [
  'propuesta',
  'confirmada',
  'corregida',
  'error',
];
/** El supervisor además puede cambiar una observación ya validada. */
const REVISABLES_SUPERVISOR: EstadoObservacion[] = [...REVISABLES_REGISTRADOR, 'validada'];

const LARGO_EXTRACTO = 140;

@Injectable()
export class ObservacionesService {
  private readonly logger = new Logger(ObservacionesService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly cola: ColaService,
    private readonly criterios: CriteriosService,
  ) {}

  hoy(): string {
    return hoyEn(this.env.ZONA_HORARIA);
  }

  /** Crea la observación como pendiente y la encola. El procesamiento ocurre en la Lambda de proceso. */
  async crear(
    identidad: Identidad,
    datos: CrearObservacionRequest,
  ): Promise<CrearObservacionResponse> {
    // El esquema garantiza `texto` para tipo texto y `clave` para audio o foto.
    const contenido =
      datos.tipo === 'texto'
        ? { texto: datos.texto! }
        : {
            archivoClave: datos.clave!,
            archivoTipo: await this.validarArchivo(identidad, datos.tipo, datos.clave!),
          };

    const observacion = await this.prisma.observacion.create({
      data: {
        usuarioId: identidad.id,
        tipo: datos.tipo,
        fecha: aColumnaFecha(this.hoy()),
        ...contenido,
      },
      select: { id: true },
    });

    try {
      await this.cola.encolar({ idObservacion: observacion.id });
    } catch (error) {
      this.logger.error(`No se pudo encolar ${observacion.id}`, error as Error);
      await this.prisma.observacion.update({
        where: { id: observacion.id },
        data: { estado: 'error', errorDetalle: 'No se pudo encolar para procesamiento' },
      });
      throw new ServiceUnavailableException(
        'No se pudo enviar la observación a procesar; intente de nuevo',
      );
    }

    return { id: observacion.id, estado: 'pendiente' };
  }

  async detalle(identidad: Identidad, id: string): Promise<ObservacionDetalle> {
    return this.aDetalle(await this.buscar(identidad, id));
  }

  /** El registrador confirma (mismo criterio que la IA) o corrige. Cerrada si ya fue validada. */
  async revisar(identidad: Identidad, id: string, criterioId: string): Promise<ObservacionDetalle> {
    await this.exigirCriterio(criterioId);
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.observacion.findFirst({
        where: this.alcance(identidad, id),
        select: { estado: true, criterioPropuestoId: true },
      });
      if (!actual) throw this.noEncontrada();
      if (actual.estado === 'validada') {
        throw new ConflictException('La observación ya fue validada por un supervisor');
      }
      if (!REVISABLES_REGISTRADOR.includes(actual.estado)) {
        throw new ConflictException('La observación aún no tiene propuesta');
      }

      const coincide = actual.criterioPropuestoId === criterioId;
      const { count } = await tx.observacion.updateMany({
        // La condición sobre el estado evita pisar una validación concurrente.
        where: { id, estado: { in: REVISABLES_REGISTRADOR } },
        data: { estado: coincide ? 'confirmada' : 'corregida', criterioId },
      });
      if (count === 0)
        throw new ConflictException('La observación ya fue validada por un supervisor');

      await this.registrarDecision(tx, {
        observacionId: id,
        usuarioId: identidad.id,
        origen: 'registrador',
        criterioId,
        coincide,
        peso: this.env.PESO_EJEMPLO_REGISTRADOR,
      });
    });
    return this.detalle(identidad, id);
  }

  /** El supervisor valida o corrige; la observación queda validada y cerrada para el registrador. */
  async validar(identidad: Identidad, id: string, criterioId: string): Promise<ObservacionDetalle> {
    await this.exigirCriterio(criterioId);
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.observacion.findFirst({
        where: this.alcance(identidad, id),
        select: { estado: true, criterioPropuestoId: true },
      });
      if (!actual) throw this.noEncontrada();
      if (!REVISABLES_SUPERVISOR.includes(actual.estado)) {
        throw new ConflictException('La observación aún no tiene propuesta');
      }

      await tx.observacion.update({
        where: { id },
        data: {
          estado: 'validada',
          criterioId,
          validadoPorId: identidad.id,
          validadoEn: new Date(),
        },
      });
      await this.registrarDecision(tx, {
        observacionId: id,
        usuarioId: identidad.id,
        origen: 'supervisor',
        criterioId,
        coincide: actual.criterioPropuestoId === criterioId,
        peso: this.env.PESO_EJEMPLO_SUPERVISOR,
      });
    });
    return this.detalle(identidad, id);
  }

  async archivo(identidad: Identidad, id: string): Promise<ArchivoResponse> {
    const observacion = await this.buscar(identidad, id);
    if (!observacion.archivoClave) throw new NotFoundException('La observación no tiene archivo');
    const firmada = await this.almacenamiento.firmarLectura(observacion.archivoClave);
    return { ...firmada, tipo: observacion.archivoTipo ?? 'application/octet-stream' };
  }

  async miDia(identidad: Identidad, fecha = this.hoy()): Promise<MiDiaResponse> {
    const observaciones = await this.prisma.observacion.findMany({
      where: { usuarioId: identidad.id, fecha: aColumnaFecha(fecha) },
      include: INCLUIR_RELACIONES,
      orderBy: { creadoEn: 'desc' },
    });
    return { fecha, observaciones: observaciones.map(aResumen) };
  }

  /**
   * Un registrador solo alcanza sus observaciones; el supervisor, todas.
   * Las ajenas se tratan como inexistentes (404) para no revelar que existen.
   */
  private alcance(identidad: Identidad, id: string): Prisma.ObservacionWhereInput {
    return identidad.rol === 'supervisor' ? { id } : { id, usuarioId: identidad.id };
  }

  private async buscar(identidad: Identidad, id: string): Promise<ObservacionConRelaciones> {
    if (!z.uuid().safeParse(id).success) throw this.noEncontrada();
    const observacion = await this.prisma.observacion.findFirst({
      where: this.alcance(identidad, id),
      include: INCLUIR_RELACIONES,
    });
    if (!observacion) throw this.noEncontrada();
    return observacion;
  }

  private noEncontrada(): NotFoundException {
    return new NotFoundException('Observación no encontrada');
  }

  private async exigirCriterio(criterioId: string): Promise<void> {
    if (!(await this.criterios.buscarActivo(criterioId))) {
      throw new UnprocessableEntityException('Criterio inexistente');
    }
  }

  /** Comprueba que el archivo esté en la carpeta de la persona, ya subido y del tipo declarado. */
  private async validarArchivo(
    identidad: Identidad,
    tipo: 'audio' | 'foto',
    clave: string,
  ): Promise<string> {
    const carpeta = this.almacenamiento.carpetaDe(identidad.id);
    if (!clave.startsWith(carpeta) || clave.includes('..')) {
      throw new UnprocessableEntityException('Archivo no válido');
    }
    const tipoArchivo = await this.almacenamiento.tipoDe(clave);
    if (!tipoArchivo) throw new UnprocessableEntityException('El archivo aún no se ha subido');
    const esperado = TIPOS_ARCHIVO[tipoArchivo as keyof typeof TIPOS_ARCHIVO]?.captura;
    if (esperado !== tipo)
      throw new UnprocessableEntityException(`El archivo no es de tipo ${tipo}`);
    return tipoArchivo;
  }

  /** Guarda la decisión en el historial y como ejemplo para el aprendizaje (uno por origen). */
  private async registrarDecision(
    tx: Prisma.TransactionClient,
    d: {
      observacionId: string;
      usuarioId: string;
      origen: 'registrador' | 'supervisor';
      criterioId: string;
      coincide: boolean;
      peso: number;
    },
  ): Promise<void> {
    await tx.revision.create({
      data: {
        observacionId: d.observacionId,
        usuarioId: d.usuarioId,
        origen: d.origen,
        criterioId: d.criterioId,
        coincideConPropuesta: d.coincide,
      },
    });
    const ejemplo = { usuarioId: d.usuarioId, criterioId: d.criterioId, peso: d.peso };
    await tx.ejemplo.upsert({
      where: { observacionId_origen: { observacionId: d.observacionId, origen: d.origen } },
      create: { observacionId: d.observacionId, origen: d.origen, ...ejemplo },
      update: ejemplo,
    });
  }

  private async aDetalle(o: ObservacionConRelaciones): Promise<ObservacionDetalle> {
    const propuesta = o.criterioPropuesto && {
      criterio: o.criterioPropuesto,
      confianza: o.confianza,
      opciones: await this.criterios.referencias(o.opciones),
      audioUrl: o.audioPropuestaClave
        ? (await this.almacenamiento.firmarLectura(o.audioPropuestaClave)).url
        : null,
    };
    return {
      id: o.id,
      tipo: o.tipo,
      estado: o.estado,
      fecha: desdeColumnaFecha(o.fecha),
      creadoEn: o.creadoEn.toISOString(),
      usuario: o.usuario,
      texto: o.texto,
      textoExtraido: o.textoExtraido,
      tieneArchivo: o.archivoClave !== null,
      propuesta,
      criterio: o.criterio,
      validadoEn: o.validadoEn?.toISOString() ?? null,
    };
  }
}

export function aResumen(o: ObservacionConRelaciones): ObservacionResumen {
  const texto = o.texto ?? o.textoExtraido;
  return {
    id: o.id,
    tipo: o.tipo,
    estado: o.estado,
    fecha: desdeColumnaFecha(o.fecha),
    creadoEn: o.creadoEn.toISOString(),
    usuario: o.usuario,
    extracto: texto ? texto.slice(0, LARGO_EXTRACTO) : null,
    criterio: o.criterio,
  };
}
