import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

const sesion = vi.hoisted(() => ({ idToken: vi.fn(), avisarSesionTerminada: vi.fn() }));
vi.mock('../auth/sesion', () => sesion);

const { fetchConToken } = await import('./fetch-con-token');

const recibidas: Request[] = [];
const servidor = setupServer(
  http.get('*/api/me', ({ request }) => {
    recibidas.push(request);
    return request.headers.get('Authorization')
      ? HttpResponse.json({ id: 'u1' })
      : new HttpResponse(JSON.stringify({ message: 'Falta el token' }), { status: 401 });
  }),
);

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  recibidas.length = 0;
  vi.clearAllMocks();
});
afterAll(() => servidor.close());

type Respuesta = { data: unknown; status: number };

describe('fetchConToken', () => {
  it('agrega el ID token y conserva las demás cabeceras', async () => {
    sesion.idToken.mockResolvedValue('id-token');

    const r = await fetchConToken<Respuesta>('http://localhost/api/me', {
      headers: { 'X-Prueba': '1' },
    });

    expect(r).toMatchObject({ status: 200, data: { id: 'u1' } });
    expect(recibidas[0]?.headers.get('Authorization')).toBe('Bearer id-token');
    expect(recibidas[0]?.headers.get('X-Prueba')).toBe('1');
    expect(sesion.avisarSesionTerminada).not.toHaveBeenCalled();
  });

  it('sin sesión no envía Authorization y un 401 avisa que la sesión terminó', async () => {
    sesion.idToken.mockResolvedValue(undefined);

    const r = await fetchConToken<Respuesta>('http://localhost/api/me');

    expect(r.status).toBe(401);
    expect(recibidas[0]?.headers.has('Authorization')).toBe(false);
    expect(sesion.avisarSesionTerminada).toHaveBeenCalledTimes(1);
  });
});
