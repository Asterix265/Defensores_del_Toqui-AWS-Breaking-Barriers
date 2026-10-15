// Piezas compartidas por los stacks de desarrollo y de producción.
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

/** Patrón de RUT chileno (con o sin puntos) para el Guardrail. */
export const PATRON_RUT = '\\b\\d{1,2}\\.?\\d{3}\\.?\\d{3}-[\\dkK]\\b';

export const GRUPOS = ['educadora', 'directora'] as const;

/** Bucket privado para audios y fotos, con borrado a los 7 días y CORS para la web. */
export function crearBucketCapturas(
  scope: Construct,
  opciones: { nombre: string; origenes: string[]; eventBridge?: boolean },
): s3.Bucket {
  return new s3.Bucket(scope, 'Capturas', {
    bucketName: opciones.nombre,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    eventBridgeEnabled: opciones.eventBridge ?? false,
    lifecycleRules: [{ id: 'borrar-a-los-7-dias', expiration: Duration.days(7) }],
    cors: [
      {
        allowedOrigins: opciones.origenes,
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag'],
        maxAge: 3000,
      },
    ],
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  });
}

/** User Pool con grupos por rol, atributo de jardín y cliente web sin secreto. */
export function crearIdentidad(
  scope: Construct,
  opciones: { nombre: string; permitirPassword: boolean },
): { pool: cognito.UserPool; cliente: cognito.UserPoolClient } {
  const pool = new cognito.UserPool(scope, 'Usuarios', {
    userPoolName: opciones.nombre,
    selfSignUpEnabled: false,
    signInAliases: { email: true },
    autoVerify: { email: true },
    standardAttributes: { email: { required: true, mutable: true } },
    // Los atributos personalizados no se pueden agregar después de crear el pool.
    customAttributes: {
      id_jardin: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: true }),
    },
    passwordPolicy: { minLength: 12, requireSymbols: false },
    accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    removalPolicy: RemovalPolicy.DESTROY,
  });

  for (const grupo of GRUPOS) {
    new cognito.CfnUserPoolGroup(scope, `Grupo-${grupo}`, {
      userPoolId: pool.userPoolId,
      groupName: grupo,
    });
  }

  const cliente = pool.addClient('ClienteWeb', {
    userPoolClientName: `${opciones.nombre}-web`,
    generateSecret: false,
    // USER_PASSWORD_AUTH solo donde se permite (desarrollo). ADMIN_USER_PASSWORD_AUTH exige
    // credenciales IAM de administración: lo usan las pruebas de humo, nunca la web.
    authFlows: { userSrp: true, userPassword: opciones.permitirPassword, adminUserPassword: true },
    preventUserExistenceErrors: true,
    readAttributes: new cognito.ClientAttributes()
      .withStandardAttributes({ email: true })
      .withCustomAttributes('id_jardin'),
    writeAttributes: new cognito.ClientAttributes().withStandardAttributes({ email: true }),
  });

  return { pool, cliente };
}

/** Guardrail que anonimiza datos personales y RUT, con una versión publicada. */
export function crearGuardrail(
  scope: Construct,
  opciones: { nombre: string; descripcionVersion: string },
): { guardrail: bedrock.CfnGuardrail; version: bedrock.CfnGuardrailVersion } {
  // inputAction/outputAction explícitos: sin ellos Bedrock solo detecta (acción NONE).
  const anonimizar = {
    action: 'ANONYMIZE',
    inputAction: 'ANONYMIZE',
    outputAction: 'ANONYMIZE',
    inputEnabled: true,
    outputEnabled: true,
  };
  const guardrail = new bedrock.CfnGuardrail(scope, 'GuardrailPii', {
    name: opciones.nombre,
    description: 'Anonimiza datos personales y RUT en entradas y salidas del modelo.',
    blockedInputMessaging: 'La solicitud contiene información que no se puede procesar.',
    blockedOutputsMessaging: 'La respuesta contenía información que no se puede mostrar.',
    sensitiveInformationPolicyConfig: {
      piiEntitiesConfig: ['NAME', 'EMAIL', 'PHONE', 'ADDRESS'].map((type) => ({
        type,
        ...anonimizar,
      })),
      regexesConfig: [
        { name: 'rut-chileno', description: 'RUT chileno', pattern: PATRON_RUT, ...anonimizar },
      ],
    },
  });
  // Una versión es inmutable: cambiar la descripción fuerza una versión nueva.
  const version = new bedrock.CfnGuardrailVersion(scope, 'GuardrailPiiVersion', {
    guardrailIdentifier: guardrail.attrGuardrailId,
    description: opciones.descripcionVersion,
  });
  return { guardrail, version };
}
