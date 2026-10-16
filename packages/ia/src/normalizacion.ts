/** Recorta, colapsa espacios y saltos repetidos y normaliza a NFC; no toca mayúsculas ni puntuación. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Texto de un resultado de Amazon Transcribe (`results.transcripts[].transcript`), unido con
 * espacio y recortado. Cadena vacía si no hay transcripción.
 */
export function textoDeTranscripcion(json: string): string {
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    throw new Error('El resultado de Transcribe no es un JSON válido.');
  }
  const transcripts = (datos as { results?: { transcripts?: unknown } } | null)?.results
    ?.transcripts;
  if (!Array.isArray(transcripts)) return '';
  return transcripts
    .map((t) => (t as { transcript?: unknown } | null)?.transcript)
    .filter((t): t is string => typeof t === 'string')
    .join(' ')
    .trim();
}
