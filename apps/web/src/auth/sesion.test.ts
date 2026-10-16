import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cognito simulado: las pruebas no llaman a AWS.
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

const { cerrarSesion, haySesion, idToken, iniciarSesion, modoLocal } = await import('./sesion');

function errorCognito(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe('sesión con Cognito', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_prueba');
    vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'cliente-prueba');
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('usa Cognito si hay configuración', () => {
    expect(modoLocal()).toBe(false);
  });

  it('ingresa con SRP', async () => {
    amplify.signIn.mockResolvedValue({ nextStep: { signInStep: 'DONE' } });

    await expect(iniciarSesion('educadora@example.com', 'clave')).resolves.toEqual({ ok: true });
    expect(amplify.signIn).toHaveBeenCalledWith({
      username: 'educadora@example.com',
      password: 'clave',
      options: { authFlowType: 'USER_SRP_AUTH' },
    });
    expect(amplify.configure).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NotAuthorizedException', 'credenciales'],
    ['UserNotFoundException', 'credenciales'],
    ['PasswordResetRequiredException', 'restablecer'],
    ['LimitExceededException', 'demasiados_intentos'],
    ['NetworkError', 'red'],
    ['OtraCosa', 'desconocido'],
  ])('traduce %s a %s', async (nombre, error) => {
    amplify.signIn.mockRejectedValue(errorCognito(nombre));
    await expect(iniciarSesion('a@b.cl', 'x')).resolves.toEqual({ ok: false, error });
  });

  it('una contraseña temporal no deja entrar todavía', async () => {
    amplify.signIn.mockResolvedValue({
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' },
    });
    await expect(iniciarSesion('a@b.cl', 'x')).resolves.toEqual({
      ok: false,
      error: 'nueva_clave',
    });
  });

  it('si quedó otra sesión en el dispositivo la cierra y reintenta', async () => {
    amplify.signIn
      .mockRejectedValueOnce(errorCognito('UserAlreadyAuthenticatedException'))
      .mockResolvedValueOnce({ nextStep: { signInStep: 'DONE' } });

    await expect(iniciarSesion('a@b.cl', 'x')).resolves.toEqual({ ok: true });
    expect(amplify.signOut).toHaveBeenCalledTimes(1);
    expect(amplify.signIn).toHaveBeenCalledTimes(2);
  });

  it('entrega el ID token, no el de acceso', async () => {
    amplify.fetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => 'id-token' }, accessToken: { toString: () => 'x' } },
    });
    await expect(idToken()).resolves.toBe('id-token');
    await expect(haySesion()).resolves.toBe(true);
  });

  it('sin tokens o si la renovación falla no hay sesión', async () => {
    amplify.fetchAuthSession.mockResolvedValueOnce({ tokens: undefined });
    await expect(haySesion()).resolves.toBe(false);
    amplify.fetchAuthSession.mockRejectedValueOnce(errorCognito('NetworkError'));
    await expect(idToken()).resolves.toBeUndefined();
  });

  it('cerrar sesión no falla aunque la revocación remota falle', async () => {
    amplify.signOut.mockRejectedValue(errorCognito('NetworkError'));
    await expect(cerrarSesion()).resolves.toBeUndefined();
    expect(amplify.signOut).toHaveBeenCalledWith();
  });
});

describe('sesión en modo local', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_COGNITO_USER_POOL_ID', '');
    vi.stubEnv('VITE_COGNITO_CLIENT_ID', '');
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('no usa Cognito ni envía token', async () => {
    expect(modoLocal()).toBe(true);
    await expect(iniciarSesion('a@b.cl', 'x')).resolves.toEqual({ ok: true });
    await expect(haySesion()).resolves.toBe(true);
    await expect(idToken()).resolves.toBeUndefined();
    expect(amplify.signIn).not.toHaveBeenCalled();

    await cerrarSesion();
    await expect(haySesion()).resolves.toBe(false);
    expect(amplify.signOut).not.toHaveBeenCalled();
  });
});
