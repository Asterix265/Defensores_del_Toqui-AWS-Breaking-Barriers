import type { BorradorEntrante, ContextoCaptura } from '@toqui/shared';

/** Lo que la extracción necesita de la captura: edad, nivel esperado y catálogo (±1 nivel). */
export type ContextoExtraccion = Pick<ContextoCaptura, 'edadMeses' | 'nivelEsperado' | 'catalogo'>;

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
