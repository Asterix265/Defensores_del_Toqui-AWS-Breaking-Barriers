import { avisarSesionTerminada, idToken } from '../auth/sesion';

/**
 * `fetch` del cliente generado por orval: agrega el ID token de la sesión y devuelve
 * `{ data, status, headers }`, como el cliente sin mutator. Un 401 avisa que la sesión terminó.
 * Las subidas a S3 con URL firmada usan `fetch` directo y no llevan el token.
 */
export async function fetchConToken<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await idToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) avisarSesionTerminada();

  const body = [204, 205, 304].includes(res.status) ? null : await res.text();
  const data: unknown = body ? JSON.parse(body) : {};
  return { data, status: res.status, headers: res.headers } as T;
}
