export function formatoHora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function claveDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/** «Hoy», «Ayer» o la fecha larga («lunes 12 de octubre»). */
export function etiquetaDia(fecha: Date, ahora: Date): string {
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (claveDia(fecha) === claveDia(ahora)) return 'Hoy';
  if (claveDia(fecha) === claveDia(ayer)) return 'Ayer';
  return fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** «Hoy 10:14», «Ayer 16:30» o «12 oct 09:15». */
export function formatoCuando(fecha: Date, ahora: Date): string {
  return `${diaCorto(fecha, ahora)} ${formatoHora(fecha)}`;
}

/** «Hoy», «Ayer» o «12 oct». */
export function diaCorto(fecha: Date, ahora: Date): string {
  const dia = etiquetaDia(fecha, ahora);
  return dia === 'Hoy' || dia === 'Ayer'
    ? dia
    : fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function formatoDuracion(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/** Marcadores con que el Guardrail reemplaza datos personales, y cómo se leen en pantalla. */
const DATOS_OCULTOS: Record<string, string> = {
  NAME: 'nombre',
  EMAIL: 'correo',
  PHONE: 'teléfono',
  ADDRESS: 'dirección',
};

/**
 * Texto anonimizado para mostrar: «{NAME} apiló…» → «[nombre] apiló…». La API devuelve el texto
 * original con los nombres; esto cubre las notas anteriores, que solo guardaron el anonimizado.
 */
export function textoLegible(texto: string): string {
  return texto.replace(
    /\{(NAME|EMAIL|PHONE|ADDRESS)\}/g,
    (_, tipo: string) => `[${DATOS_OCULTOS[tipo]}]`,
  );
}
