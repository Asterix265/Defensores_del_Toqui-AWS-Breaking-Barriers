/**
 * Consultas a la API que usa «Registro Simple». Solo lecturas síncronas: niños y niñas,
 * catálogo, niveles y trayectoria. El procesamiento de las notas sigue simulado en la web.
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { getGetMeQueryKey, getMe } from '../api/generated/auth/auth';
import {
  getListarManifestacionesQueryKey,
  getListarNivelesQueryKey,
  listarManifestaciones,
  listarNiveles,
} from '../api/generated/catalogo/catalogo';
import {
  getListarNinosQueryKey,
  getObtenerTrayectoriaQueryKey,
  listarNinos,
  obtenerTrayectoria,
} from '../api/generated/ninos/ninos';
import type {
  ManifestacionDtoOutput,
  NinoDtoOutput,
  NivelRutaDtoOutput,
  ObservacionTrayectoriaOutput,
} from '../api/generated/model';
import type { Nucleo, Nino } from './datos';

export type Manifestacion = ManifestacionDtoOutput & { nucleo: Nucleo };
export type NivelRuta = NivelRutaDtoOutput;
export type ObservacionApi = ObservacionTrayectoriaOutput;

/** Error HTTP de la API, con el código para distinguir 403 de una caída. */
export class ErrorApi extends Error {
  constructor(readonly status: number) {
    super(`La API respondió ${status}`);
    this.name = 'ErrorApi';
  }
}

/** ¿La API respondió 403 (sin grupo o jardín en el token)? */
export function esSinPermiso(error: unknown): boolean {
  return error instanceof ErrorApi && error.status === 403;
}

/** El cliente generado no lanza ante un error HTTP: se convierte aquí para que React Query lo vea. */
export async function datos<T>(respuesta: Promise<{ data: T; status: number }>): Promise<T> {
  const { data, status } = await respuesta;
  if (status < 200 || status >= 300) throw new ErrorApi(status);
  return data;
}

/** Quién tiene la sesión, su grupo y su jardín, según el token (`GET /me`). */
export function useIdentidad() {
  return useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: ({ signal }) => datos(getMe({ signal })),
    staleTime: Infinity,
  });
}

/** Colores de avatar del tema; se elige uno estable por id. */
const PALETA_AVATAR = [
  { fondo: '#FDE8EA', tinta: '#92001c' },
  { fondo: '#FDF4DC', tinta: '#594400' },
  { fondo: '#E6F4E7', tinta: '#005312' },
  { fondo: '#E3ECFA', tinta: '#1d3f73' },
  { fondo: '#F1E6FA', tinta: '#4f2a73' },
  { fondo: '#FFF1DB', tinta: '#7a4300' },
  { fondo: '#E0F3F1', tinta: '#0f5049' },
  { fondo: '#FCE4F0', tinta: '#7a1f4f' },
  { fondo: '#EFE4D8', tinta: '#3A2414' },
];

function hash(texto: string): number {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Datos de la API más lo que solo es presentación: nombre corto, iniciales y color. */
export function aNino(n: NinoDtoOutput): Nino {
  const nombre = n.nombres.split(' ')[0] ?? n.nombres;
  const apellido = n.apellidos.split(' ')[0] ?? n.apellidos;
  return {
    id: n.id,
    nombre: `${nombre} ${apellido.charAt(0)}.`,
    nombreCompleto: `${n.nombres} ${n.apellidos}`,
    iniciales: `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase(),
    sala: n.sala,
    nivelEducativo: n.nivelEducativo,
    edadMeses: n.edadMeses,
    ...(PALETA_AVATAR[hash(n.id) % PALETA_AVATAR.length] as (typeof PALETA_AVATAR)[number]),
  };
}

const NOMBRE_NIVEL_EDUCATIVO: Record<string, string> = {
  SC: 'Sala Cuna',
  NM: 'Nivel Medio',
  TR: 'Transición',
};

/** «SC-01» → «Sala Cuna 1» (y el formato anterior «SG-A» → «Sala A»). */
export function etiquetaSala(sala: string): string {
  const [, nivel, numero] = /^(SC|NM|TR)-0*(\d+)$/.exec(sala) ?? [];
  if (nivel && numero) return `${NOMBRE_NIVEL_EDUCATIVO[nivel]} ${numero}`;
  const letra = /^SG-(.+)$/.exec(sala)?.[1];
  return letra ? `Sala ${letra}` : sala;
}

const ORDEN_NIVEL: Record<string, number> = { SC: 0, NM: 1, TR: 2 };

/**
 * Salas en el orden de las edades (Sala Cuna, Nivel Medio, Transición) y por número; las demás
 * (`SG-A`) van después, por código.
 */
export function ordenarSalas(salas: string[]): string[] {
  const clave = (sala: string) => {
    const [, nivel, numero] = /^(SC|NM|TR)-0*(\d+)$/.exec(sala) ?? [];
    return nivel ? [ORDEN_NIVEL[nivel]!, Number(numero)] : [3, 0];
  };
  return [...salas].sort((a, b) => {
    const [na, xa] = clave(a);
    const [nb, xb] = clave(b);
    return na! - nb! || xa! - xb! || a.localeCompare(b);
  });
}

/** Niños y niñas del jardín de quien usa la app (todas las salas). */
export function useNinos() {
  return useQuery({
    queryKey: getListarNinosQueryKey(),
    queryFn: ({ signal }) => datos(listarNinos(undefined, { signal })),
    select: (lista) => lista.map(aNino),
    staleTime: 5 * 60_000,
  });
}

/** Catálogo de manifestaciones y niveles de la ruta: no cambian durante la sesión. */
export function useCatalogo() {
  const manifestaciones = useQuery({
    queryKey: getListarManifestacionesQueryKey(),
    queryFn: ({ signal }) => datos(listarManifestaciones(undefined, { signal })),
    select: (lista) => lista as Manifestacion[],
    staleTime: Infinity,
  });
  const niveles = useQuery({
    queryKey: getListarNivelesQueryKey(),
    queryFn: ({ signal }) => datos(listarNiveles({ signal })),
    staleTime: Infinity,
  });
  return {
    manifestaciones: manifestaciones.data,
    niveles: niveles.data,
    isPending: manifestaciones.isPending || niveles.isPending,
    isError: manifestaciones.isError || niveles.isError,
    error: manifestaciones.error ?? niveles.error,
  };
}

/** Años de historial que pide la ficha: el dataset tiene pocos registros recientes por niño o niña. */
const ANIOS_HISTORIAL = 3;

/** Fecha `AAAA-MM-DD` de hace `ANIOS_HISTORIAL` años, en hora local. */
function desdeHistorial(): string {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() - ANIOS_HISTORIAL);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function opcionesTrayectoria(idNino: string) {
  const params = { desde: desdeHistorial() };
  return {
    queryKey: getObtenerTrayectoriaQueryKey(idNino, params),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      datos(obtenerTrayectoria(idNino, params, { signal })),
    select: (t: { observaciones: ObservacionApi[] }) => t.observaciones,
    staleTime: 60_000,
  };
}

/** Observaciones registradas del niño o niña en los últimos `ANIOS_HISTORIAL` años. */
export function useObservaciones(idNino: string) {
  return useQuery(opcionesTrayectoria(idNino));
}

/** Observaciones de varios niños o niñas a la vez, en el mismo orden que `ids`. */
export function useObservacionesDe(ids: string[]) {
  return useQueries({ queries: ids.map(opcionesTrayectoria) });
}
