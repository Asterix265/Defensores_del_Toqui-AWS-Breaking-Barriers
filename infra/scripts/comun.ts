// Utilidades compartidas por los scripts de AWS de desarrollo.
import { existsSync } from 'node:fs';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

export const REGION = 'us-east-1';
export const STACK_DEV = 'ToquiDev';

/** Stack objetivo: `--stack <nombre>` o TOQUI_STACK; por defecto el de desarrollo. */
export function stackObjetivo(): string {
  const i = process.argv.indexOf('--stack');
  return (i >= 0 ? process.argv[i + 1] : undefined) ?? process.env['TOQUI_STACK'] ?? STACK_DEV;
}

/** Usuarios sintéticos de prueba; ninguno corresponde a una persona real. */
export const USUARIOS_PRUEBA = [
  { email: 'educadora.jar0001@example.com', grupo: 'educadora', idJardin: 'JAR-0001' },
  { email: 'directora.jar0001@example.com', grupo: 'directora', idJardin: 'JAR-0001' },
] as const;

export const MODELOS = {
  extraccion: 'us.anthropic.claude-opus-5',
  resumen: 'us.anthropic.claude-haiku-5-5',
} as const;

export interface SalidasDev {
  BucketCapturas: string;
  UserPoolId: string;
  UserPoolClientId: string;
  GuardrailId: string;
  GuardrailVersion: string;
}

/**
 * Carga infra/.env si existe y usa el perfil `toqui` salvo que AWS_PROFILE indique otro. En la CI
 * (credenciales OIDC en el entorno) no fija perfil: no existe y el SDK fallaría al buscarlo.
 */
export function prepararCredenciales(): void {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const conCredenciales =
    process.env['AWS_ACCESS_KEY_ID'] ||
    process.env['AWS_WEB_IDENTITY_TOKEN_FILE'] ||
    process.env['CI'] === 'true';
  if (!conCredenciales) process.env['AWS_PROFILE'] ??= 'toqui';
  process.env['AWS_REGION'] ??= REGION;
}

/** Todas las salidas de un stack, para no copiar IDs a mano. */
export async function leerSalidasStack(stack: string): Promise<Record<string, string>> {
  const cfn = new CloudFormationClient({ region: REGION });
  const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: stack }));
  return Object.fromEntries(
    (Stacks?.[0]?.Outputs ?? []).map((o) => [o.OutputKey ?? '', o.OutputValue ?? '']),
  );
}

/** Salidas comunes de ToquiDev o ToquiApp (bucket, Cognito y Guardrail). */
export async function leerSalidas(stack = stackObjetivo()): Promise<SalidasDev> {
  const salidas = await leerSalidasStack(stack);
  const claves: (keyof SalidasDev)[] = [
    'BucketCapturas',
    'UserPoolId',
    'UserPoolClientId',
    'GuardrailId',
    'GuardrailVersion',
  ];
  const faltantes = claves.filter((clave) => !salidas[clave]);
  if (faltantes.length > 0) {
    throw new Error(`El stack ${stack} no expone: ${faltantes.join(', ')}. ¿Está desplegado?`);
  }
  return salidas as unknown as SalidasDev;
}

/**
 * Usuario con el que la prueba de humo ingresa a Cognito: el personal de `infra/.env`
 * (TOQUI_PERSONAL_EMAIL y TOQUI_PERSONAL_PASSWORD) si está completo; si no, la educadora
 * compartida con TOQUI_DEV_PASSWORD. Solo la compartida declara el grupo y el jardín esperados;
 * del personal se exige que el token traiga un grupo válido y un jardín, sean cuales sean.
 */
export function usuarioSmoke(): {
  email: string;
  password: string;
  esperado?: { grupo: string; idJardin: string };
} {
  const email = process.env['TOQUI_PERSONAL_EMAIL'];
  const password = process.env['TOQUI_PERSONAL_PASSWORD'];
  if (email && password) return { email, password };
  const { email: compartido, grupo, idJardin } = USUARIOS_PRUEBA[0];
  return { email: compartido, password: contrasenaPrueba(), esperado: { grupo, idJardin } };
}

/** Contraseña de los usuarios de prueba; nunca se guarda en el repositorio. */
export function contrasenaPrueba(): string {
  const valor = process.env['TOQUI_DEV_PASSWORD'];
  if (!valor || valor.length < 12) {
    throw new Error(
      'Define TOQUI_DEV_PASSWORD (mínimo 12 caracteres, con mayúsculas, minúsculas y números).',
    );
  }
  return valor;
}
