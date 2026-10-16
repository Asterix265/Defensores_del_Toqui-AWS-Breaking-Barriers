/**
 * Tipos y etiquetas de «Registro Simple». Los niños, niñas, el catálogo, los registros y las
 * notas vienen de la API (`api.ts`, `registrar.ts`).
 */
import type { Manifestacion } from './api';

export type Formato = 'audio' | 'foto' | 'texto';

/** Núcleos de aprendizaje del dataset E1 por núcleos (ver docs/contexto-desafio.md). */
export type Nucleo = 'IA' | 'CC' | 'CM' | 'LV' | 'LA' | 'EN' | 'ES' | 'PM';

export interface Nino {
  id: string;
  /** Nombre corto para la interfaz («Antonella F.»). */
  nombre: string;
  nombreCompleto: string;
  iniciales: string;
  /** Código local de la sala en el dataset (`SC-01`). */
  sala: string;
  /** Sala Cuna, Nivel Medio o Transición: define qué parte de la rúbrica corresponde. */
  nivelEducativo: 'SC' | 'NM' | 'TR';
  edadMeses: number;
  fondo: string;
  tinta: string;
}

/** Manifestación del catálogo con la cita del texto que la respalda (null si la agregó la tía). */
export interface ManifestacionCitada {
  manifestacion: Manifestacion;
  cita: string | null;
}

/** Núcleos de las manifestaciones de la nota, sin repetir y en orden de aparición. */
export function nucleosDe(manifestaciones: { manifestacion: { nucleo: Nucleo } }[]): Nucleo[] {
  return [...new Set(manifestaciones.map((m) => m.manifestacion.nucleo))];
}

/** En el orden de los ámbitos de las Bases Curriculares. */
export const NUCLEOS: Nucleo[] = ['IA', 'CC', 'CM', 'LV', 'LA', 'EN', 'ES', 'PM'];

/** Nombre corto para chips y tarjetas; el nombre completo viene de `GET /nucleos`. */
export const ETIQUETA_NUCLEO: Record<Nucleo, string> = {
  IA: 'Identidad',
  CC: 'Convivencia',
  CM: 'Movimiento',
  LV: 'Lenguaje',
  LA: 'Artes',
  EN: 'Naturaleza',
  ES: 'Sociocultural',
  PM: 'Matemático',
};

export const COLOR_NUCLEO: Record<Nucleo, { fondo: string; tinta: string }> = {
  IA: { fondo: '#FDE8EA', tinta: '#92001c' },
  CC: { fondo: '#FCE4F0', tinta: '#7a1f4f' },
  CM: { fondo: '#E6F4E7', tinta: '#005312' },
  LV: { fondo: '#E3ECFA', tinta: '#1d3f73' },
  LA: { fondo: '#FFF1DB', tinta: '#7a4300' },
  EN: { fondo: '#E0F3F1', tinta: '#0f5049' },
  ES: { fondo: '#EFE4D8', tinta: '#3A2414' },
  PM: { fondo: '#F1E6FA', tinta: '#4f2a73' },
};
