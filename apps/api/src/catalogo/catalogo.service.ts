import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Manifestacion,
  NivelEducativo,
  NivelRuta,
  Nino,
  NucleoCatalogo,
  TrayectoriaResponse,
} from '@toqui/shared';
import type { Identidad } from '../auth/identidad';
import { desdeColumnaFecha, edadEnMeses, hoyEn, sumarDias, aColumnaFecha } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import type { Nino as NinoFila, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Periodo por defecto de la trayectoria. */
const DIAS_TRAYECTORIA = 180;
/** Con menos observaciones que esto en el periodo se muestra el aviso de evidencia limitada. */
const MINIMO_EVIDENCIA = 3;

/** Campos de una manifestación con su descriptor, para armar `Manifestacion`. */
export const SELECT_MANIFESTACION = {
  id: true,
  tipo: true,
  textoObservable: true,
  descriptor: {
    select: { id: true, idVersion: true, idNucleo: true, idNivelEducativo: true, nivel: true },
  },
} satisfies Prisma.ManifestacionSelect;

type ManifestacionFila = Prisma.ManifestacionGetPayload<{ select: typeof SELECT_MANIFESTACION }>;

export function aManifestacion(m: ManifestacionFila): Manifestacion {
  return {
    id: m.id,
    idDescriptor: m.descriptor.id,
    nucleo: m.descriptor.idNucleo,
    nivelEducativo: m.descriptor.idNivelEducativo as NivelEducativo,
    nivel: m.descriptor.nivel,
    tipo: m.tipo,
    textoObservable: m.textoObservable,
  };
}

@Injectable()
export class CatalogoService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  hoy(): string {
    return hoyEn(this.env.ZONA_HORARIA);
  }

  async ninos(identidad: Identidad, sala?: string): Promise<Nino[]> {
    const filas = await this.prisma.nino.findMany({
      where: { idJardin: identidad.idJardin, ...(sala && { salaGrupo: sala }) },
      orderBy: [{ salaGrupo: 'asc' }, { nombreCompleto: 'asc' }, { id: 'asc' }],
    });
    return filas.map((n) => this.aNino(n));
  }

  /** Niño o niña del jardín de la persona: 404 si no existe, 403 si es de otro jardín. */
  async ninoDelJardin(identidad: Identidad, idNino: string): Promise<NinoFila> {
    const nino = await this.prisma.nino.findUnique({ where: { id: idNino } });
    if (!nino) throw new NotFoundException('Niño o niña no encontrado');
    if (nino.idJardin !== identidad.idJardin) {
      throw new ForbiddenException('El niño o niña pertenece a otro jardín');
    }
    return nino;
  }

  async manifestaciones(filtro: {
    nivel?: number;
    nucleo?: string;
    nivelEducativo?: NivelEducativo;
  }): Promise<Manifestacion[]> {
    const filas = await this.prisma.manifestacion.findMany({
      where: {
        descriptor: {
          nivel: filtro.nivel,
          idNucleo: filtro.nucleo,
          idNivelEducativo: filtro.nivelEducativo,
        },
      },
      orderBy: { id: 'asc' },
      select: SELECT_MANIFESTACION,
    });
    return filas.map(aManifestacion);
  }

  async niveles(): Promise<NivelRuta[]> {
    const filas = await this.prisma.nivelTrayectoria.findMany({ orderBy: { nivel: 'asc' } });
    return filas.map((n) => ({ nivel: n.nivel, nombre: n.nombreNivel }));
  }

  async nucleos(): Promise<NucleoCatalogo[]> {
    return this.prisma.nucleo.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, nombre: true, ambito: true, origen: true },
    });
  }

  /**
   * Trayectoria por núcleo: las valoraciones del periodo (dataset y app) y las observaciones con
   * su evidencia. Un núcleo sin evidencia en el periodo se informa como «sin registros», no como
   * ausencia de aprendizaje.
   */
  async trayectoria(
    identidad: Identidad,
    idNino: string,
    periodo: { desde?: string; hasta?: string },
  ): Promise<TrayectoriaResponse> {
    const nino = await this.ninoDelJardin(identidad, idNino);
    const hasta = periodo.hasta ?? this.hoy();
    const desde = periodo.desde ?? sumarDias(hasta, -DIAS_TRAYECTORIA);
    const rango = { gte: aColumnaFecha(desde), lte: aColumnaFecha(hasta) };

    const [nucleos, observaciones, valoraciones] = await Promise.all([
      this.prisma.nucleo.findMany({ orderBy: { id: 'asc' }, select: { id: true } }),
      this.prisma.observacion.findMany({
        where: { idNino, fechaObservacion: rango },
        orderBy: [{ fechaObservacion: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          fechaObservacion: true,
          formatoCaptura: true,
          notaBreve: true,
          textoObservacion: true,
          origen: true,
          vinculos: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              cita: true,
              alcance: true,
              manifestacion: { select: SELECT_MANIFESTACION },
            },
          },
        },
      }),
      this.prisma.valoracion.findMany({
        where: { idNino, fechaCorte: rango },
        orderBy: [{ fechaCorte: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          idNucleo: true,
          fechaCorte: true,
          nivelSugerido: true,
          nivelValidado: true,
          estado: true,
          origen: true,
        },
      }),
    ]);

    const conEvidencia = new Set(
      observaciones.flatMap((o) => o.vinculos.map((v) => v.manifestacion.descriptor.idNucleo)),
    );
    return {
      nino: this.aNino(nino),
      desde,
      hasta,
      totalObservaciones: observaciones.length,
      evidenciaLimitada: observaciones.length < MINIMO_EVIDENCIA,
      nucleos: nucleos.map(({ id }) => ({
        nucleo: id,
        sinRegistros: !conEvidencia.has(id),
        valoraciones: valoraciones
          .filter((v) => v.idNucleo === id)
          .map((v) => ({
            id: v.id,
            fechaCorte: desdeColumnaFecha(v.fechaCorte),
            nivelSugerido: v.nivelSugerido,
            nivelValidado: v.nivelValidado,
            estado: v.estado,
            origen: v.origen,
          })),
      })),
      observaciones: observaciones
        .map((o) => {
          const evidencias = o.vinculos.map((v) => ({
            id: v.id,
            manifestacion: aManifestacion(v.manifestacion),
            fragmento: v.cita,
            alcance: v.alcance,
          }));
          return {
            id: o.id,
            fecha: desdeColumnaFecha(o.fechaObservacion),
            formato: o.formatoCaptura,
            origen: o.origen,
            notaBreve: o.notaBreve,
            textoObservacion: o.textoObservacion,
            manifestaciones: unicas(evidencias.map((e) => e.manifestacion)),
            evidencias,
          };
        })
        .reverse(),
    };
  }

  aNino(n: NinoFila): Nino {
    const fechaNacimiento = desdeColumnaFecha(n.fechaNacimiento);
    const [nombres = n.nombreCompleto, ...apellidos] = n.nombreCompleto.split(' ');
    return {
      id: n.id,
      nombres,
      apellidos: apellidos.join(' '),
      nombreCompleto: n.nombreCompleto,
      sala: n.salaGrupo,
      idSala: n.idSala,
      nivelEducativo: n.idNivelEducativo as NivelEducativo,
      fechaNacimiento,
      edadMeses: edadEnMeses(fechaNacimiento, this.hoy()),
    };
  }
}

/** Manifestaciones sin repetir, en orden de aparición. */
function unicas(lista: Manifestacion[]): Manifestacion[] {
  return [...new Map(lista.map((m) => [m.id, m])).values()];
}
