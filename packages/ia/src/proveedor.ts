import type { BorradorEntrante, Manifestacion } from '@toqui/shared';

/**
 * Lo que la extracción necesita de la captura, sin datos que identifiquen al niño o niña: edad,
 * nivel esperado y catálogo de los niveles esperado ±1 (D7).
 */
export interface ContextoExtraccion {
  edadMeses: number;
  nivelEsperado: number;
  catalogo: Manifestacion[];
}

/** Proveedor de IA intercambiable (D8): `fake` para desarrollo y `bedrock` en AWS. */
export interface IaProvider {
  readonly nombre: string;
  /** Propone un borrador cuyas citas aparecen literalmente en `textoFuente` del resultado. */
  extraer(texto: string, contexto: ContextoExtraccion): Promise<BorradorEntrante>;
}

/** Con menos caracteres que esto el borrador sale con evidencia insuficiente. */
export const MINIMO_TEXTO = 20;

/** Texto que se guarda cuando la fuente no trae nada reconocible (audio en silencio, foto vacía). */
export const SIN_TEXTO = '(sin texto reconocible)';

export function borradorInsuficiente(
  textoFuente: string,
  proveedor: string,
  modelo?: string,
): BorradorEntrante {
  return {
    textoFuente: textoFuente.trim() || SIN_TEXTO,
    nivelSugerido: null,
    evidenciaInsuficiente: true,
    manifestaciones: [],
    proveedor,
    ...(modelo && { modelo }),
  };
}
