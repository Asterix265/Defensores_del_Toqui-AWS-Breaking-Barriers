/**
 * Sesión con Cognito simulado (con ID token): 401, cierre con peticiones en vuelo y fallas de red.
 * El resto de las pruebas de la app usan el modo local, sin token.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';

const amplify = vi.hoisted(() => ({
  configure: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  fetchAuthSession: vi.fn(),
}));
vi.mock('aws-amplify', () => ({ Amplify: { configure: amplify.configure } }));
vi.mock('aws-amplify/auth', () => ({
  signIn: amplify.signIn,
  signOut: amplify.signOut,
  fetchAuthSession: amplify.fetchAuthSession,
}));

const { conProveedores, reiniciarApi, servidor } = await import('./prueba-api');
const { AVISO_SESION_TERMINADA, RegistroApp } = await import('./RegistroApp');

/** Token sintético que se entrega a la API falsa; no es un JWT real. */
const TOKEN = 'token-de-prueba';
const conToken = () => ({ tokens: { idToken: { toString: () => TOKEN } } });
function errorRed() {
  const error = new Error('Network error');
  error.name = 'NetworkError';
  return error;
}

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  reiniciarApi();
  vi.unstubAllEnvs();
});
afterAll(() => servidor.close());

beforeEach(() => {
  vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_prueba');
  vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'cliente-prueba');
  vi.clearAllMocks();
  localStorage.clear();
  amplify.signOut.mockResolvedValue(undefined);
  amplify.fetchAuthSession.mockResolvedValue(conToken());
});

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

describe('sesión con Cognito', () => {
  it('si la API rechaza el token vuelve al ingreso con un aviso y revoca la sesión', async () => {
    servidor.use(http.get('*/ninos', () => new HttpResponse(null, { status: 401 })));
    conProveedores(<RegistroApp />);

    expect(await screen.findByRole('form', { name: 'Ingreso' })).toBeInTheDocument();
    expect(screen.getByText(AVISO_SESION_TERMINADA)).toBeInTheDocument();
    await waitFor(() => expect(amplify.signOut).toHaveBeenCalledTimes(1));
  });

  it('varios 401 a la vez cierran la sesión una sola vez', async () => {
    servidor.use(
      http.get('*/me', () => new HttpResponse(null, { status: 401 })),
      http.get('*/ninos', () => new HttpResponse(null, { status: 401 })),
    );
    conProveedores(<RegistroApp />);

    expect(await screen.findByRole('form', { name: 'Ingreso' })).toBeInTheDocument();
    expect(screen.getAllByText(AVISO_SESION_TERMINADA)).toHaveLength(1);
    await waitFor(() => expect(amplify.signOut).toHaveBeenCalledTimes(1));
  });

  it('cerrar sesión con una petición en vuelo no muestra «Tu sesión terminó»', async () => {
    conProveedores(<RegistroApp />);
    await screen.findByRole('heading', { name: 'Hola, Mercedes' });

    // Una consulta de notas queda en vuelo y la API la rechaza después del cierre.
    let soltar!: () => void;
    const enVuelo = new Promise<void>((r) => (soltar = r));
    servidor.use(
      http.get('*/capturas', async () => {
        await enVuelo;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    // La revocación en Cognito tarda: la pantalla no la espera.
    let revocar!: () => void;
    amplify.signOut.mockReturnValue(new Promise<void>((r) => (revocar = r)));
    fireEvent.click(boton('Mis notas'));
    // «Cerrar sesión» está en el inicio; la consulta de notas sigue en vuelo.
    fireEvent.click(boton('Inicio'));

    fireEvent.click(boton('Cerrar sesión'));
    const dialogo = await screen.findByRole('dialog', { name: '¿Cerrar sesión?' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('form', { name: 'Ingreso' })).toBeInTheDocument();
    soltar();
    revocar();
    await delay(50);
    expect(screen.queryByText(AVISO_SESION_TERMINADA)).not.toBeInTheDocument();
    expect(amplify.signOut).toHaveBeenCalledTimes(1);
  });

  it('si la red falla al renovar el token, abre la app y no cierra la sesión', async () => {
    // Dos fallas: StrictMode ejecuta dos veces la comprobación de sesión al abrir.
    amplify.fetchAuthSession
      .mockRejectedValueOnce(errorRed())
      .mockRejectedValueOnce(errorRed())
      .mockResolvedValue(conToken());
    conProveedores(<RegistroApp />);

    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    expect(amplify.signOut).not.toHaveBeenCalled();
  });

  it('sin red durante el uso no envía peticiones sin token ni cierra la sesión', async () => {
    const sinToken = vi.fn();
    servidor.use(
      http.get('*/ninos', ({ request }) => {
        if (!request.headers.has('Authorization')) sinToken();
        return undefined;
      }),
    );
    amplify.fetchAuthSession
      .mockResolvedValueOnce(conToken()) // haySesion al abrir
      .mockRejectedValue(errorRed()); // todas las consultas
    conProveedores(<RegistroApp />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con la API');
    expect(sinToken).not.toHaveBeenCalled();
    expect(amplify.signOut).not.toHaveBeenCalled();
    expect(screen.queryByRole('form', { name: 'Ingreso' })).not.toBeInTheDocument();
  });

  it('ingresar de nuevo espera a que termine la revocación anterior', async () => {
    servidor.use(
      http.get('*/ninos', () => new HttpResponse(null, { status: 401 }), { once: true }),
    );
    let revocar!: () => void;
    amplify.signOut.mockReturnValue(new Promise<void>((r) => (revocar = r)));
    amplify.signIn.mockResolvedValue({ nextStep: { signInStep: 'DONE' } });
    conProveedores(<RegistroApp />);
    await screen.findByRole('form', { name: 'Ingreso' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Correo' }), {
      target: { value: 'mercedes@integra.cl' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave' } });
    fireEvent.click(boton('Entrar'));
    await delay(20);
    expect(amplify.signIn).not.toHaveBeenCalled();

    revocar();
    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    expect(amplify.signIn).toHaveBeenCalledTimes(1);
  });
});
