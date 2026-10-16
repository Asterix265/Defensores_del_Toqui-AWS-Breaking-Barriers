import type { Manifestacion } from '@toqui/shared';
import type { ContextoExtraccion, ManifestacionCatalogo } from '../proveedor.js';

/*
 * Catálogos sintéticos para las pruebas, inventados para este paquete (no copiados del
 * dataset). Los códigos de núcleo (`MF`, `LC`…) también son inventados.
 */

const NUCLEOS_PRUEBA = ['CO', 'LC', 'MF', 'MG', 'SE'] as const;

/** Textos fijos de algunas manifestaciones; el resto es genérico. */
const TEXTOS_DATASET: Record<string, string> = {
  'MAN-L07-MF-01': 'Apila 4 bloques',
  'MAN-L07-LC-01': 'Dice palabras sueltas para nombrar a personas cercanas',
  'MAN-L06-MF-01': 'Toma objetos pequeños con pinza fina',
  'MAN-L08-MF-01': 'Encaja piezas grandes en un tablero',
};

/** Rúbrica tipo dataset: 8 niveles × 5 núcleos × 2 manifestaciones (tipada como en shared). */
export function catalogoDataset(): Manifestacion[] {
  const catalogo: Manifestacion[] = [];
  for (let nivel = 1; nivel <= 8; nivel++) {
    for (const nucleo of NUCLEOS_PRUEBA) {
      for (const n of [1, 2]) {
        const id = `MAN-L0${nivel}-${nucleo}-0${n}`;
        catalogo.push({
          id,
          idDescriptor: `RUB-SC-${nucleo}-0${nivel}`,
          nucleo,
          nivelEducativo: 'SC',
          nivel,
          tipo: n === 1 ? 'conducta_descriptor' : 'ejemplo_ilustrativo',
          textoObservable: TEXTOS_DATASET[id] ?? `Conducta ficticia ${n} de ${nucleo}${nivel}`,
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
    NUCLEOS_INVENTADOS.forEach((nucleo, i) => {
      const id = `RUB-N${nivel}-${String(i + 1).padStart(2, '0')}`;
      catalogo.push({
        id,
        nivel,
        nucleo,
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

/** Contexto típico: nivel de referencia 7 y catálogo de los niveles 6 a 8. */
export function contextoNivel7(): ContextoExtraccion {
  return {
    edadMeses: 30,
    nivelEsperado: 7,
    catalogo: filtrarNiveles(catalogoDataset(), [6, 7, 8]),
  };
}
