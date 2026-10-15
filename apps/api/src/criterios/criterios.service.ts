import { Injectable } from '@nestjs/common';
import type { Criterio } from '@toqui/shared';
import { PrismaService } from '../prisma/prisma.service';

/** La lista es fija: se guarda en memoria un minuto para no consultarla en cada sondeo. */
const VIGENCIA_MS = 60_000;

@Injectable()
export class CriteriosService {
  private cache: { criterios: Criterio[]; hasta: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Criterios activos, en el orden de los botones. */
  async listar(): Promise<Criterio[]> {
    if (this.cache && this.cache.hasta > Date.now()) return this.cache.criterios;
    const criterios = await this.prisma.criterio.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, descripcion: true },
    });
    this.cache = { criterios, hasta: Date.now() + VIGENCIA_MS };
    return criterios;
  }

  async buscarActivo(id: string): Promise<Criterio | null> {
    return (await this.listar()).find((c) => c.id === id) ?? null;
  }

  /** Nombres de una lista de IDs, ignorando los que ya no existan. */
  async referencias(ids: string[]): Promise<{ id: string; nombre: string }[]> {
    const criterios = await this.listar();
    return ids.flatMap((id) => {
      const criterio = criterios.find((c) => c.id === id);
      return criterio ? [{ id: criterio.id, nombre: criterio.nombre }] : [];
    });
  }
}
