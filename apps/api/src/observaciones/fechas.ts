/** Fecha `AAAA-MM-DD` de hoy en la zona horaria indicada. */
export function hoyEn(zonaHoraria: string, ahora = new Date()): string {
  // en-CA formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(ahora);
}

/** Valor para una columna `@db.Date` (Prisma la representa a medianoche UTC). */
export function aColumnaFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export function desdeColumnaFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
