import type { PrismaService } from '../prisma/prisma.service';
import { nivelReferencia } from './nivel';

/** Prisma mínimo: devuelve las valoraciones ya ordenadas de la más reciente a la más antigua. */
function prismaCon(filas: { idNucleo: string; nivelValidado: number }[]): PrismaService {
  return { valoracion: { findMany: async () => filas } } as unknown as PrismaService;
}

describe('nivelReferencia', () => {
  it('1 si el niño o niña no tiene niveles validados', async () => {
    await expect(nivelReferencia(prismaCon([]), 'NINO-00001')).resolves.toBe(1);
  });

  it('usa solo el último nivel validado de cada núcleo', async () => {
    const filas = [
      { idNucleo: 'IA', nivelValidado: 5 },
      { idNucleo: 'CM', nivelValidado: 3 },
      { idNucleo: 'IA', nivelValidado: 1 },
      { idNucleo: 'LV', nivelValidado: 4 },
    ];
    // Últimos: IA 5, CM 3, LV 4 → mediana 4.
    await expect(nivelReferencia(prismaCon(filas), 'NINO-00001')).resolves.toBe(4);
  });

  it('con una cantidad par de núcleos redondea la mediana', async () => {
    const filas = [
      { idNucleo: 'IA', nivelValidado: 2 },
      { idNucleo: 'CM', nivelValidado: 5 },
    ];
    await expect(nivelReferencia(prismaCon(filas), 'NINO-00001')).resolves.toBe(4);
  });
});
