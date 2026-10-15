export type Periodo = 'hoy' | '7dias' | 'todo';

export const ETIQUETA_PERIODO: Record<Periodo, string> = {
  hoy: 'Hoy',
  '7dias': 'Últimos 7 días',
  todo: 'Todo',
};

/** Inicio del periodo (medianoche de hoy o de hace 6 días); `null` si no hay límite. */
export function desde(periodo: Periodo, ahora: Date): Date | null {
  if (periodo === 'todo') return null;
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  if (periodo === '7dias') inicio.setDate(inicio.getDate() - 6);
  return inicio;
}
