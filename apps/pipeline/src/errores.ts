/**
 * Fallo que no se arregla reintentando (audio sin voz, imagen demasiado grande, borrador
 * rechazado por la API). Se informa a la API de inmediato y el mensaje sale de la cola.
 * `detalle` lo ve la educadora: legible y sin datos personales.
 */
export class ErrorPermanente extends Error {
  constructor(readonly detalle: string) {
    super(detalle);
    this.name = 'ErrorPermanente';
  }
}

/**
 * La captura ya no admite borrador (no existe, o ya se confirmó o descartó). No hay nada que
 * informar: el mensaje se descarta.
 */
export class ErrorCapturaCerrada extends Error {
  constructor(readonly status: number) {
    super(`La API rechazó la entrega con ${status}: la captura ya no está procesando`);
    this.name = 'ErrorCapturaCerrada';
  }
}

/** Cualquier otro error se considera transitorio: SQS reintenta el mensaje. */
