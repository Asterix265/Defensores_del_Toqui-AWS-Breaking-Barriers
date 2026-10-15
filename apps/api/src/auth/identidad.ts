import type { Rol } from '@toqui/shared';

/** Persona autenticada, tomada siempre del token y nunca del cuerpo de la petición. */
export interface Identidad {
  /** `sub` de Cognito. */
  id: string;
  rol: Rol;
  nombre: string | null;
  telefono: string | null;
}

declare module 'express' {
  interface Request {
    identidad?: Identidad;
  }
}

/** Rol con más permisos entre los grupos del token, o null si no pertenece a ninguno. */
export function rolDesdeGrupos(grupos: unknown): Rol | null {
  const lista = Array.isArray(grupos) ? grupos : [];
  if (lista.includes('supervisor')) return 'supervisor';
  if (lista.includes('registrador')) return 'registrador';
  return null;
}
