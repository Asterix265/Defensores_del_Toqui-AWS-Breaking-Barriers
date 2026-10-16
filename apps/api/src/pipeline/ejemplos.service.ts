import { Inject, Injectable } from '@nestjs/common';
import {
  LARGO_EJEMPLO,
  MAXIMO_EJEMPLOS,
  type EjemploDecision,
  type NivelEducativo,
} from '@toqui/shared';
import { z } from 'zod';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/** Antigüedad máxima de una decisión para usarla como ejemplo. */
const DIAS_EJEMPLOS = 90;
/** Candidatas que se leen antes de filtrar por catálogo y ordenar. */
const CANDIDATAS = 50;

const FinalSchema = z.object({
  nivel: z.number().int(),
  manifestaciones: z.array(z.object({ idManifestacion: z.string() })),
});

/**
 * Aprender de las correcciones (panel-directora-y-aprendizaje, D4): decisiones previas de
 * educadoras del mismo jardín y nivel educativo, para que la IA las reciba como ejemplos. Primero
 * las que corrigieron a la IA y, entre ellas, las más recientes. El texto es el `textoFuente` del
 * borrador, que ya pasó por el anonimizador; no se devuelve ningún ID.
 */
@Injectable()
export class EjemplosService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  async ejemplos(consulta: {
    idJardin: string;
    nivelEducativo: NivelEducativo;
    /** Manifestaciones permitidas en el mensaje: un ejemplo fuera del catálogo confundiría. */
    catalogo: ReadonlySet<string>;
    /** La captura que se procesa no es ejemplo de sí misma. */
    excluir: string;
  }): Promise<EjemploDecision[]> {
    const maximo = Math.min(this.env.EJEMPLOS_CORRECCIONES, MAXIMO_EJEMPLOS);
    if (maximo === 0) return [];
    const desde = new Date(Date.now() - DIAS_EJEMPLOS * 24 * 60 * 60 * 1000);
    const filas = await this.prisma.correccion.findMany({
      where: {
        decision: { in: ['confirmada', 'corregida'] },
        creadoEn: { gte: desde },
        idCaptura: { not: consulta.excluir },
        captura: {
          idJardin: consulta.idJardin,
          nino: { idNivelEducativo: consulta.nivelEducativo },
          borrador: { isNot: null },
        },
      },
      // Postgres ordena el enum por su declaración (confirmada, corregida, descartada): con `desc`
      // `corregida` queda antes que `confirmada`.
      orderBy: [{ decision: 'desc' }, { creadoEn: 'desc' }],
      take: CANDIDATAS,
      select: {
        decision: true,
        final: true,
        captura: { select: { borrador: { select: { textoFuente: true } } } },
      },
    });

    const ejemplos: EjemploDecision[] = [];
    for (const fila of filas) {
      const final = FinalSchema.safeParse(fila.final);
      const texto = fila.captura.borrador?.textoFuente.trim();
      if (!final.success || !texto) continue;
      const ids = final.data.manifestaciones
        .map((m) => m.idManifestacion)
        .filter((id) => consulta.catalogo.has(id));
      if (ids.length === 0 || final.data.nivel < 1 || final.data.nivel > 8) continue;
      ejemplos.push({
        textoFuente: recortar(texto, LARGO_EJEMPLO),
        nivel: final.data.nivel,
        idsManifestaciones: ids.slice(0, 5),
        corregida: fila.decision === 'corregida',
      });
      if (ejemplos.length === maximo) break;
    }
    return ejemplos;
  }
}

function recortar(texto: string, maximo: number): string {
  const caracteres = Array.from(texto);
  return caracteres.length <= maximo ? texto : `${caracteres.slice(0, maximo - 1).join('')}…`;
}
