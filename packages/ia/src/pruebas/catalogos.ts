import type { Manifestacion } from '@toqui/shared';
import type { ContextoExtraccion, ManifestacionCatalogo } from '../proveedor.js';

/*
 * Catálogos sintéticos para las pruebas, inventados para este paquete (no copiados del
 * dataset). Solo los ids imitan el formato del dataset (`MAN-L07-MF-01`).
 */

const DOMINIOS_DATASET = [
  ['CO', 'cognitivo'],
  ['LC', 'lenguaje_comunicacion'],
  ['MF', 'motor_fino'],
  ['MG', 'motor_grueso'],
  ['SE', 'socioemocional'],
] as const;

/** Textos fijos de algunas manifestaciones; el resto es genérico. */
const TEXTOS_DATASET: Record<string, string> = {
  'MAN-L07-MF-01': 'Apila 4 bloques',
  'MAN-L07-LC-01': 'Dice palabras sueltas para nombrar a personas cercanas',
  'MAN-L06-MF-01': 'Toma objetos pequeños con pinza fina',
  'MAN-L08-MF-01': 'Encaja piezas grandes en un tablero',
};

/** Ruta tipo dataset: 9 niveles × 5 dominios × 2 manifestaciones (tipada como en shared). */
export function catalogoDataset(): Manifestacion[] {
  const catalogo: Manifestacion[] = [];
  for (let nivel = 1; nivel <= 9; nivel++) {
    for (const [codigo, dominio] of DOMINIOS_DATASET) {
      for (const n of [1, 2]) {
        const id = `MAN-L0${nivel}-${codigo}-0${n}`;
        catalogo.push({
          id,
          nivel,
          dominio,
          textoObservable: TEXTOS_DATASET[id] ?? `Conducta ficticia ${n} de ${codigo}${nivel}`,
        });
      }
    }
  }
  return catalogo;
}

/** Núcleos con nombres que el módulo no puede conocer. */
export const NUCLEOS_INVENTADOS = [
  'nucleo_brisa',
  'nucleo_cometa',
  'nucleo_duna',
  'nucleo_eco',
  'nucleo_faro',
  'nucleo_glaciar',
  'nucleo_huerto',
  'nucleo_isla',
  'nucleo_junco',
  'nucleo_lago',
];

const TEXTOS_OCHO: Record<string, string> = {
  'RUB-N3-05': 'Ordena piezas de colores según su tamaño',
  'RUB-N3-08': 'Comparte materiales con otro niño durante el juego',
};

/** Rúbrica inventada: 8 niveles × 10 núcleos, una manifestación por núcleo y nivel. */
export function catalogoOchoPorDiez(): ManifestacionCatalogo[] {
  const catalogo: ManifestacionCatalogo[] = [];
  for (let nivel = 1; nivel <= 8; nivel++) {
    NUCLEOS_INVENTADOS.forEach((dominio, i) => {
      const id = `RUB-N${nivel}-${String(i + 1).padStart(2, '0')}`;
      catalogo.push({
        id,
        nivel,
        dominio,
        textoObservable: TEXTOS_OCHO[id] ?? `Conducta ficticia ${i + 1} del tramo ${nivel}`,
      });
    });
  }
  return catalogo;
}

export function filtrarNiveles<T extends ManifestacionCatalogo>(
  catalogo: T[],
  niveles: number[],
): T[] {
  return catalogo.filter((m) => niveles.includes(m.nivel));
}

/** Contexto típico: nivel esperado 7 y catálogo ±1 de la ruta tipo dataset. */
export function contextoNivel7(): ContextoExtraccion {
  return {
    edadMeses: 30,
    nivelEsperado: 7,
    catalogo: filtrarNiveles(catalogoDataset(), [6, 7, 8]),
  };
}
