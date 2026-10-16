import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { BorradorEntranteSchema, type BorradorEntrante } from '@toqui/shared';
import { ErrorIa } from './errores.js';

/** Estructuralmente compatible con `Manifestacion` de shared, pero con `nucleo` abierto. */
export interface ManifestacionCatalogo {
  id: string;
  nivel: number;
  nucleo: string;
  textoObservable: string;
}

export interface ContextoExtraccion {
  edadMeses: number;
  /** Nivel de referencia (último validado del niño o niña); contexto, no un límite. */
  nivelEsperado: number;
  /** Ya filtrado por el llamador (nivel educativo). Define los niveles y núcleos válidos. */
  catalogo: ManifestacionCatalogo[];
}

export type FormatoImagen = 'jpeg' | 'png';

export interface IaProvider {
  readonly nombre: 'fake' | 'bedrock';
  extraer(texto: string, contexto: ContextoExtraccion): Promise<BorradorEntrante>;
  normalizarFoto(imagen: Uint8Array, formato: FormatoImagen): Promise<string>;
}

export type ConfigIa =
  | { proveedor: 'fake' }
  | {
      proveedor: 'bedrock';
      modelo: string;
      region?: string;
      guardrail?: { id: string; version: string };
      /** Solo desarrollo local: permite Bedrock sin Guardrail. Por defecto el Guardrail es obligatorio. */
      sinGuardrail?: boolean;
      /** Inyectable para pruebas. */
      cliente?: Pick<BedrockRuntimeClient, 'send'>;
    };

export type ResultadoValidacion =
  | { ok: true; borrador: Omit<BorradorEntrante, 'proveedor' | 'modelo'> }
  | { ok: false; problemas: string[] };

/** Con menos caracteres que esto no se llama al modelo: evidencia insuficiente. */
export const MINIMO_TEXTO = 20;
/** Tope de `BorradorEntranteSchema`. */
export const MAXIMO_MANIFESTACIONES = 5;
/** Texto de una foto o nota sin contenido legible. */
export const SIN_TEXTO = '(sin texto reconocible)';
/** Respuesta fija de la lectura de foto cuando no se ve actividad. */
export const SIN_ACTIVIDAD = 'Sin actividad observable.';
/** Máximo de bytes de imagen que acepta Converse (3,75 MB). */
export const TAMANO_MAXIMO_IMAGEN = 3.75 * 1024 * 1024;

const FORMATOS_IMAGEN: readonly string[] = ['jpeg', 'png'] satisfies FormatoImagen[];

/** Sin nivel ni manifestaciones: no es un error, es falta de evidencia en la nota. */
export function sinEvidencia(textoFuente: string): Omit<BorradorEntrante, 'proveedor' | 'modelo'> {
  return {
    textoFuente: textoFuente || SIN_TEXTO,
    nivelSugerido: null,
    evidenciaInsuficiente: true,
    manifestaciones: [],
  };
}

export function borradorInsuficiente(
  textoFuente: string,
  proveedor: IaProvider['nombre'],
  modelo?: string,
): BorradorEntrante {
  return { ...sinEvidencia(textoFuente), proveedor, ...(modelo ? { modelo } : {}) };
}

/** Texto que no amerita llamar al modelo: muy corto o la lectura fija de una foto vacía. */
export function textoSinEvidencia(texto: string): boolean {
  return texto.length < MINIMO_TEXTO || texto === SIN_ACTIVIDAD || texto === SIN_TEXTO;
}

/** Rechaza la foto antes de llamar a cualquier modelo; el mensaje se muestra a la educadora. */
export function validarImagen(imagen: Uint8Array, formato: string): void {
  if (!FORMATOS_IMAGEN.includes(formato)) {
    throw new ErrorIa('FOTO_NO_VALIDA', 'La foto debe ser JPEG o PNG.');
  }
  if (imagen.byteLength > TAMANO_MAXIMO_IMAGEN) {
    throw new ErrorIa('FOTO_NO_VALIDA', 'La foto supera el máximo de 3,75 MB.');
  }
}

/** Última barrera: si el borrador no cumple el contrato, se entrega evidencia insuficiente. */
export function entregar(
  borrador: BorradorEntrante & { proveedor: IaProvider['nombre'] },
): BorradorEntrante {
  const resultado = BorradorEntranteSchema.safeParse(borrador);
  if (resultado.success) return resultado.data;
  return borradorInsuficiente(borrador.textoFuente, borrador.proveedor, borrador.modelo);
}
