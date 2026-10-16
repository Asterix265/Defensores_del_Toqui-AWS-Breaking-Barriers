/**
 * Sesión de la web. Con `VITE_COGNITO_*` usa el User Pool de Cognito (flujo SRP con Amplify
 * Auth: la contraseña nunca viaja). Sin ellas, modo local: un ingreso de prueba sin token, para
 * la API con `AUTH_MODE=local`.
 */
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';

/** Motivos por los que no se pudo ingresar; la pantalla de ingreso los traduce. */
export type ErrorIngreso =
  | 'credenciales'
  | 'nueva_clave'
  | 'restablecer'
  | 'sin_confirmar'
  | 'paso_no_soportado'
  | 'demasiados_intentos'
  | 'red'
  | 'desconocido';

export type ResultadoIngreso = { ok: true } | { ok: false; error: ErrorIngreso };

/** Marca del modo local: solo indica que hubo ingreso; no es una credencial. */
export const CLAVE_SESION_LOCAL = 'toqui.sesion.local';

interface ConfigCognito {
  userPoolId: string;
  userPoolClientId: string;
}

/** Se lee al llamar (no al importar) para que las pruebas puedan cambiar el entorno. */
function configCognito(): ConfigCognito | null {
  const userPoolId = import.meta.env['VITE_COGNITO_USER_POOL_ID'] as string | undefined;
  const userPoolClientId = import.meta.env['VITE_COGNITO_CLIENT_ID'] as string | undefined;
  return userPoolId && userPoolClientId ? { userPoolId, userPoolClientId } : null;
}

export function modoLocal(): boolean {
  return configCognito() === null;
}

let configurado = false;

/** Configura Amplify una sola vez; en modo local no hace nada. */
export function configurarAuth(): void {
  const config = configCognito();
  if (!config || configurado) return;
  Amplify.configure({ Auth: { Cognito: { ...config, loginWith: { email: true } } } });
  configurado = true;
}

function nombreError(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

function traducir(error: unknown): ErrorIngreso {
  switch (nombreError(error)) {
    // Con `preventUserExistenceErrors` Cognito responde igual si el correo no existe.
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
    case 'EmptySignInUsername':
    case 'EmptySignInPassword':
      return 'credenciales';
    case 'PasswordResetRequiredException':
      return 'restablecer';
    case 'UserNotConfirmedException':
      return 'sin_confirmar';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'demasiados_intentos';
    case 'NetworkError':
      return 'red';
    default:
      return 'desconocido';
  }
}

export async function iniciarSesion(correo: string, clave: string): Promise<ResultadoIngreso> {
  if (modoLocal()) {
    try {
      localStorage.setItem(CLAVE_SESION_LOCAL, correo);
    } catch {
      // Sin almacenamiento la sesión local dura lo que la pestaña.
    }
    return { ok: true };
  }
  configurarAuth();
  const intentar = () =>
    signIn({ username: correo, password: clave, options: { authFlowType: 'USER_SRP_AUTH' } });
  try {
    let resultado;
    try {
      resultado = await intentar();
    } catch (error) {
      // Quedó una sesión anterior en el dispositivo: se cierra y se reintenta una vez.
      if (nombreError(error) !== 'UserAlreadyAuthenticatedException') throw error;
      await signOut();
      resultado = await intentar();
    }
    switch (resultado.nextStep.signInStep) {
      case 'DONE':
        return { ok: true };
      case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
        return { ok: false, error: 'nueva_clave' };
      case 'RESET_PASSWORD':
        return { ok: false, error: 'restablecer' };
      case 'CONFIRM_SIGN_UP':
        return { ok: false, error: 'sin_confirmar' };
      default:
        // MFA u otro desafío que la web todavía no ofrece: se descarta el intento a medias.
        await signOut().catch(() => undefined);
        return { ok: false, error: 'paso_no_soportado' };
    }
  } catch (error) {
    return { ok: false, error: traducir(error) };
  }
}

/**
 * ¿Hay una sesión en este dispositivo? Si la renovación del token falla por red, Amplify conserva
 * los tokens: la sesión sigue y las consultas reintentan. Solo un refresh token inválido o
 * ausente cuenta como «sin sesión».
 */
export async function haySesion(): Promise<boolean> {
  if (modoLocal()) {
    try {
      return localStorage.getItem(CLAVE_SESION_LOCAL) !== null;
    } catch {
      return false;
    }
  }
  try {
    return (await idToken()) !== undefined;
  } catch {
    return true;
  }
}

/**
 * ID token vigente para la API; Amplify lo renueva con el refresh token si venció.
 * El de acceso no sirve: la API necesita el correo y `custom:id_jardin`.
 * `undefined` = no hay sesión (o el refresh token ya no sirve). Una falla transitoria (red,
 * Cognito no disponible) se propaga como error para no confundirla con una sesión terminada.
 */
export async function idToken(): Promise<string | undefined> {
  if (modoLocal()) return undefined;
  configurarAuth();
  const { tokens } = await fetchAuthSession();
  return tokens?.idToken?.toString();
}

/**
 * Cierra la sesión del dispositivo: Cognito revoca el refresh token y Amplify borra los tokens
 * guardados. Si la red falla, los tokens locales se borran igual.
 */
export async function cerrarSesion(): Promise<void> {
  try {
    localStorage.removeItem(CLAVE_SESION_LOCAL);
  } catch {
    // Nada que borrar.
  }
  if (modoLocal()) return;
  configurarAuth();
  try {
    await signOut();
  } catch {
    // signOut ya limpió el almacenamiento local antes de fallar la revocación remota.
  }
}

// --- Aviso de sesión terminada (la API respondió 401) ---

const eventos = new EventTarget();
const SESION_TERMINADA = 'sesion-terminada';

export function avisarSesionTerminada(): void {
  eventos.dispatchEvent(new Event(SESION_TERMINADA));
}

/** Suscribe a la sesión terminada; devuelve la función para desuscribirse. */
export function alTerminarSesion(fn: () => void): () => void {
  eventos.addEventListener(SESION_TERMINADA, fn);
  return () => eventos.removeEventListener(SESION_TERMINADA, fn);
}
