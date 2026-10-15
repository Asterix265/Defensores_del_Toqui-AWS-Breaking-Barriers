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

/**
 * Edad en meses completos según el diccionario de datos:
 * `12*(año_obs-año_nac)+(mes_obs-mes_nac)-1[día_obs<día_nac]`.
 */
export function edadEnMeses(nacimiento: string, fecha: string): number {
  const [an, mn, dn] = nacimiento.split('-').map(Number) as [number, number, number];
  const [ao, mo, dobs] = fecha.split('-').map(Number) as [number, number, number];
  return 12 * (ao - an) + (mo - mn) - (dobs < dn ? 1 : 0);
}

/** Suma (o resta) días a una fecha `AAAA-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const d = aColumnaFecha(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return desdeColumnaFecha(d);
}
