import type { Grupo } from '@toqui/shared';

/** Persona autenticada, tomada siempre del token y nunca del cuerpo de la petición. */
export interface Identidad {
  /** `sub` de Cognito. */
  id: string;
  email: string | null;
  nombre: string | null;
  grupo: Grupo;
  /** `custom:id_jardin`: todo lo que ve y registra queda dentro de este jardín. */
  idJardin: string;
}

declare module 'express' {
  interface Request {
    identidad?: Identidad;
  }
}

/** Grupo con más permisos entre los del token, o null si no pertenece a ninguno. */
export function grupoDesdeToken(grupos: unknown): Grupo | null {
  const lista = Array.isArray(grupos) ? grupos : [];
  if (lista.includes('directora')) return 'directora';
  if (lista.includes('educadora')) return 'educadora';
  return null;
}

/** Nombre visible de quien registra: nombre del token o, si falta, su correo. */
export function autorDe(identidad: Identidad): string {
  return identidad.nombre ?? identidad.email ?? identidad.id;
}
