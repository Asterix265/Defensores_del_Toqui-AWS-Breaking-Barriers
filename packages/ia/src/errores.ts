/** Fallas que reintentar no corrige. Los errores del SDK de Bedrock se propagan tal cual. */
export type CodigoErrorIa = 'FOTO_NO_VALIDA' | 'GUARDRAIL_NO_DISPONIBLE' | 'CONFIGURACION_INVALIDA';

export class ErrorIa extends Error {
  override readonly name = 'ErrorIa';

  constructor(
    readonly codigo: CodigoErrorIa,
    mensaje: string,
  ) {
    super(mensaje);
  }
}
