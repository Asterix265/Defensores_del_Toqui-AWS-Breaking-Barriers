import type { PrismaService } from '../prisma/prisma.service';

/**
 * Nivel de referencia para la IA (migrar-dataset-nucleos, D7): mediana redondeada del último
 * nivel validado de cada núcleo del niño o niña; 1 si aún no tiene ninguno. No es un nivel
 * esperado para la edad: el dataset por núcleos no define niveles por edad.
 */
export async function nivelReferencia(prisma: PrismaService, idNino: string): Promise<number> {
  const filas = await prisma.valoracion.findMany({
    where: { idNino, nivelValidado: { not: null } },
    orderBy: [{ fechaCorte: 'desc' }, { id: 'desc' }],
    select: { idNucleo: true, nivelValidado: true },
  });
  const ultimos = new Map<string, number>();
  for (const f of filas) {
    if (!ultimos.has(f.idNucleo)) ultimos.set(f.idNucleo, f.nivelValidado!);
  }
  const niveles = [...ultimos.values()].sort((a, b) => a - b);
  if (niveles.length === 0) return 1;
  const medio = Math.floor(niveles.length / 2);
  const mediana =
    niveles.length % 2 ? niveles[medio]! : (niveles[medio - 1]! + niveles[medio]!) / 2;
  return Math.round(mediana);
}
