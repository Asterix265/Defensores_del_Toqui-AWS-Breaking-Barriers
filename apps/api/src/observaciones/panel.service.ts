import { Injectable } from '@nestjs/common';
import type {
  PanelObservacionesQuery,
  PanelObservacionesResponse,
  PanelResumenResponse,
} from '@toqui/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { aColumnaFecha } from './fechas';
import { aResumen, INCLUIR_RELACIONES } from './observaciones.service';

@Injectable()
export class PanelService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: PanelObservacionesQuery): Promise<PanelObservacionesResponse> {
    const where: Prisma.ObservacionWhereInput = {
      ...(query.fecha && { fecha: aColumnaFecha(query.fecha) }),
      ...(query.usuarioId && { usuarioId: query.usuarioId }),
      ...(query.criterioId && { criterioId: query.criterioId }),
      ...(query.estado && { estado: query.estado }),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.observacion.count({ where }),
      this.prisma.observacion.findMany({
        where,
        include: INCLUIR_RELACIONES,
        orderBy: [{ creadoEn: 'desc' }, { id: 'asc' }],
        skip: (query.pagina - 1) * query.tamano,
        take: query.tamano,
      }),
    ]);
    return { items: items.map(aResumen), total, pagina: query.pagina, tamano: query.tamano };
  }

  /** Totales del día por criterio vigente, por estado y por persona. */
  async resumen(fecha: string): Promise<PanelResumenResponse> {
    const where = { fecha: aColumnaFecha(fecha) };
    const [porCriterio, porEstado, porPersona] = await Promise.all([
      this.prisma.observacion.groupBy({ by: ['criterioId'], where, _count: { _all: true } }),
      this.prisma.observacion.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.observacion.groupBy({ by: ['usuarioId'], where, _count: { _all: true } }),
    ]);

    const [criterios, usuarios] = await Promise.all([
      this.prisma.criterio.findMany({
        where: { id: { in: porCriterio.flatMap((g) => (g.criterioId ? [g.criterioId] : [])) } },
        select: { id: true, nombre: true },
      }),
      this.prisma.usuario.findMany({
        where: { id: { in: porPersona.map((g) => g.usuarioId) } },
        select: { id: true, nombre: true },
      }),
    ]);

    const descendente = (a: { total: number }, b: { total: number }) => b.total - a.total;
    return {
      fecha,
      total: porEstado.reduce((suma, g) => suma + g._count._all, 0),
      porCriterio: porCriterio
        .map((g) => ({
          criterio: criterios.find((c) => c.id === g.criterioId) ?? null,
          total: g._count._all,
        }))
        .sort(descendente),
      porEstado: porEstado
        .map((g) => ({ estado: g.estado, total: g._count._all }))
        .sort(descendente),
      porPersona: porPersona
        .map((g) => ({
          usuario: usuarios.find((u) => u.id === g.usuarioId) ?? { id: g.usuarioId, nombre: null },
          total: g._count._all,
        }))
        .sort(descendente),
    };
  }
}
