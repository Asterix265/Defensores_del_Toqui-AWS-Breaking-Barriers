/**
 * Tipos y etiquetas de «Registro Simple». Los niños, niñas, el catálogo, los registros y las
 * notas vienen de la API (`api.ts`, `registrar.ts`).
 */
import type { Manifestacion } from './api';

export type Formato = 'audio' | 'foto' | 'texto';

/** Dominios del dataset sintético (ver docs/contexto-desafio.md). */
export type Dominio =
  'cognitivo' | 'lenguaje_comunicacion' | 'motor_fino' | 'motor_grueso' | 'socioemocional';

export interface Nino {
  id: string;
  /** Nombre corto para la interfaz («Antonella F.»). */
  nombre: string;
  nombreCompleto: string;
  iniciales: string;
  /** Código del grupo en el dataset (`SG-A`). */
  sala: string;
  edadMeses: number;
  fondo: string;
  tinta: string;
}

/** Manifestación del catálogo con la cita del texto que la respalda (null si la agregó la tía). */
export interface ManifestacionCitada {
  manifestacion: Manifestacion;
  cita: string | null;
}

/** Dominios de las manifestaciones de la nota, sin repetir y en orden de aparición. */
export function dominiosDe(manifestaciones: { manifestacion: { dominio: Dominio } }[]): Dominio[] {
  return [...new Set(manifestaciones.map((m) => m.manifestacion.dominio))];
}

export const DOMINIOS: Dominio[] = [
  'lenguaje_comunicacion',
  'motor_fino',
  'motor_grueso',
  'socioemocional',
  'cognitivo',
];

export const ETIQUETA_DOMINIO: Record<Dominio, string> = {
  cognitivo: 'Cognitivo',
  lenguaje_comunicacion: 'Lenguaje',
  motor_fino: 'Motor fino',
  motor_grueso: 'Motor grueso',
  socioemocional: 'Socioemocional',
};

export const COLOR_DOMINIO: Record<Dominio, { fondo: string; tinta: string }> = {
  cognitivo: { fondo: '#F1E6FA', tinta: '#4f2a73' },
  lenguaje_comunicacion: { fondo: '#E3ECFA', tinta: '#1d3f73' },
  motor_fino: { fondo: '#FFF1DB', tinta: '#7a4300' },
  motor_grueso: { fondo: '#E6F4E7', tinta: '#005312' },
  socioemocional: { fondo: '#FDE8EA', tinta: '#92001c' },
};
