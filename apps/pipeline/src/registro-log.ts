/**
 * Log estructurado en JSON para CloudWatch. Nunca registrar texto de la nota, transcripciones,
 * citas ni nombres: solo ids, pasos, tiempos y conteos.
 */
export type Log = (
  nivel: 'info' | 'warn' | 'error',
  mensaje: string,
  datos?: Record<string, unknown>,
) => void;

export const log: Log = (nivel, mensaje, datos = {}) => {
  const linea = JSON.stringify({ nivel, mensaje, ...datos });
  if (nivel === 'error') console.error(linea);
  else if (nivel === 'warn') console.warn(linea);
  else console.info(linea);
};

/** Nombre y mensaje del error, sin la pila ni el contenido de la captura. */
export function describirError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { error: error.name, detalle: error.message };
  return { error: String(error) };
}
