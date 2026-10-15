// Utilidades compartidas por los scripts de AWS de desarrollo.
import { existsSync } from 'node:fs';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

export const REGION = 'us-east-1';
export const STACK_DEV = 'ToquiDev';

/** Usuarios sintéticos de prueba; ninguno corresponde a una persona real. */
export const USUARIOS_PRUEBA = [
  { email: 'educadora.jar0001@example.com', grupo: 'educadora', idJardin: 'JAR-0001' },
  { email: 'directora.jar0001@example.com', grupo: 'directora', idJardin: 'JAR-0001' },
] as const;

export const MODELOS = {
  extraccion: 'us.anthropic.claude-sonnet-5-5',
  resumen: 'us.anthropic.claude-haiku-5-5',
} as const;

export interface SalidasDev {
  BucketCapturas: string;
  UserPoolId: string;
  UserPoolClientId: string;
  GuardrailId: string;
  GuardrailVersion: string;
}

/** Carga infra/.env si existe y usa el perfil `toqui` salvo que AWS_PROFILE indique otro. */
export function prepararCredenciales(): void {
  if (existsSync('.env')) process.loadEnvFile('.env');
  process.env['AWS_PROFILE'] ??= 'toqui';
  process.env['AWS_REGION'] ??= REGION;
}

/** Lee las salidas del stack ToquiDev, para no copiar IDs a mano. */
export async function leerSalidas(): Promise<SalidasDev> {
  const cfn = new CloudFormationClient({ region: REGION });
  const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: STACK_DEV }));
  const salidas = Object.fromEntries(
    (Stacks?.[0]?.Outputs ?? []).map((o) => [o.OutputKey ?? '', o.OutputValue ?? '']),
  );
  const claves: (keyof SalidasDev)[] = [
    'BucketCapturas',
    'UserPoolId',
    'UserPoolClientId',
    'GuardrailId',
    'GuardrailVersion',
  ];
  const faltantes = claves.filter((clave) => !salidas[clave]);
  if (faltantes.length > 0) {
    throw new Error(`El stack ${STACK_DEV} no expone: ${faltantes.join(', ')}. ¿Está desplegado?`);
  }
  return salidas as unknown as SalidasDev;
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
