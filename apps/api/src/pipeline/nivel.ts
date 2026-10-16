import type { PrismaService } from '../prisma/prisma.service';

/** Nivel de la ruta cuyo rango de edad contiene la edad; el último si la supera. */
export async function nivelEsperado(prisma: PrismaService, edadMeses: number): Promise<number> {
  const niveles = await prisma.nivel.findMany({ orderBy: { nivel: 'asc' } });
  const enRango = niveles.find((n) => edadMeses >= n.edadMinMeses && edadMeses < n.edadMaxMeses);
  return enRango?.nivel ?? niveles.at(-1)?.nivel ?? 1;
}
