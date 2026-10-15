import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Dominio, Manifestacion, Nino, NivelRuta, TrayectoriaResponse } from '@toqui/shared';
import type { Identidad } from '../auth/identidad';
import { desdeColumnaFecha, edadEnMeses, hoyEn, sumarDias, aColumnaFecha } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import type { Nino as NinoFila } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DOMINIOS: Dominio[] = [
  'motor_grueso',
  'motor_fino',
  'lenguaje_comunicacion',
  'socioemocional',
  'cognitivo',
];

/** Periodo por defecto de la trayectoria. */
const DIAS_TRAYECTORIA = 180;
/** Con menos observaciones que esto en el periodo se muestra el aviso de evidencia limitada. */
const MINIMO_EVIDENCIA = 3;

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
      orderBy: [{ salaGrupo: 'asc' }, { nombres: 'asc' }, { id: 'asc' }],
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

  async manifestaciones(filtro: { nivel?: number; dominio?: Dominio }): Promise<Manifestacion[]> {
    return this.prisma.manifestacion.findMany({
      where: { nivel: filtro.nivel, dominio: filtro.dominio },
      orderBy: { id: 'asc' },
      select: { id: true, nivel: true, dominio: true, textoObservable: true },
    });
  }

  async niveles(): Promise<NivelRuta[]> {
    const filas = await this.prisma.nivel.findMany({ orderBy: { nivel: 'asc' } });
    return filas.map((n) => ({
      nivel: n.nivel,
      nombre: n.nombreNivel,
      edadMinMeses: n.edadMinMeses,
      edadMaxMeses: n.edadMaxMeses,
    }));
  }

  /**
   * Observaciones del niño o niña por dominio (dataset y app). Un dominio sin observaciones
   * en el periodo se informa como «sin registros», no como ausencia de aprendizaje.
   */
  async trayectoria(
    identidad: Identidad,
    idNino: string,
    periodo: { desde?: string; hasta?: string },
  ): Promise<TrayectoriaResponse> {
    const nino = await this.ninoDelJardin(identidad, idNino);
    const hasta = periodo.hasta ?? this.hoy();
    const desde = periodo.desde ?? sumarDias(hasta, -DIAS_TRAYECTORIA);

    const observaciones = await this.prisma.observacion.findMany({
      where: {
        idNino,
        fechaObservacion: { gte: aColumnaFecha(desde), lte: aColumnaFecha(hasta) },
      },
      orderBy: [{ fechaObservacion: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        fechaObservacion: true,
        formatoCaptura: true,
        nivelEstimado: true,
        notaBreve: true,
        origen: true,
        vinculos: {
          orderBy: { idManifestacion: 'asc' },
          select: {
            manifestacion: {
              select: { id: true, nivel: true, dominio: true, textoObservable: true },
            },
          },
        },
      },
    });

    return {
      nino: this.aNino(nino),
      desde,
      hasta,
      totalObservaciones: observaciones.length,
      evidenciaLimitada: observaciones.length < MINIMO_EVIDENCIA,
      dominios: DOMINIOS.map((dominio) => {
        const puntos = observaciones
          .filter((o) => o.vinculos.some((v) => v.manifestacion.dominio === dominio))
          .map((o) => ({
            idObservacion: o.id,
            fecha: desdeColumnaFecha(o.fechaObservacion),
            nivelEstimado: o.nivelEstimado,
            origen: o.origen,
          }));
        return { dominio, sinRegistros: puntos.length === 0, puntos };
      }),
      observaciones: observaciones
        .map((o) => ({
          id: o.id,
          fecha: desdeColumnaFecha(o.fechaObservacion),
          formato: o.formatoCaptura,
          origen: o.origen,
          nivelEstimado: o.nivelEstimado,
          notaBreve: o.notaBreve,
          manifestaciones: o.vinculos.map((v) => v.manifestacion),
        }))
        .reverse(),
    };
  }

  aNino(n: NinoFila): Nino {
    const fechaNacimiento = desdeColumnaFecha(n.fechaNacimiento);
    return {
      id: n.id,
      nombres: n.nombres,
      apellidos: n.apellidos,
      sala: n.salaGrupo,
      fechaNacimiento,
      edadMeses: edadEnMeses(fechaNacimiento, this.hoy()),
    };
  }
}
