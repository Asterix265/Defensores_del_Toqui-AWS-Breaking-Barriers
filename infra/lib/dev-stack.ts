import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

/** Origen de la web en desarrollo local, autorizado para subir con URL prefirmada. */
export const ORIGEN_WEB_LOCAL = 'http://localhost:5173';

/** Patrón de RUT chileno (con o sin puntos) para el Guardrail. */
export const PATRON_RUT = '\\b\\d{1,2}\\.?\\d{3}\\.?\\d{3}-[\\dkK]\\b';

/**
 * Recursos AWS compartidos para desarrollo: capturas en S3, identidad en Cognito y
 * Guardrail de Bedrock. Desechable: `cdk destroy ToquiDev` borra todo, incluido el contenido.
 */
export class DevStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    Tags.of(this).add('proyecto', 'defensores-del-toqui');
    Tags.of(this).add('evento', 'aws-breaking-barriers-2026');
    Tags.of(this).add('ambiente', 'dev');

    const capturas = new s3.Bucket(this, 'Capturas', {
      bucketName: `toqui-dev-capturas-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      lifecycleRules: [{ id: 'borrar-a-los-7-dias', expiration: Duration.days(7) }],
      cors: [
        {
          allowedOrigins: [ORIGEN_WEB_LOCAL],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const usuarios = new cognito.UserPool(this, 'Usuarios', {
      userPoolName: 'toqui-dev',
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

    for (const grupo of ['educadora', 'directora']) {
      new cognito.CfnUserPoolGroup(this, `Grupo-${grupo}`, {
        userPoolId: usuarios.userPoolId,
        groupName: grupo,
      });
    }

    const clienteWeb = usuarios.addClient('ClienteWeb', {
      userPoolClientName: 'toqui-dev-web',
      generateSecret: false,
      // USER_PASSWORD_AUTH solo en desarrollo, para la prueba de humo; la demo usará solo SRP.
      authFlows: { userSrp: true, userPassword: true },
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('id_jardin'),
      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({ email: true }),
    });

    // inputAction/outputAction explícitos: sin ellos Bedrock solo detecta (acción NONE).
    const anonimizar = {
      action: 'ANONYMIZE',
      inputAction: 'ANONYMIZE',
      outputAction: 'ANONYMIZE',
      inputEnabled: true,
      outputEnabled: true,
    };
    const guardrail = new bedrock.CfnGuardrail(this, 'GuardrailPii', {
      name: 'toqui-dev-pii',
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
    const guardrailVersion = new bedrock.CfnGuardrailVersion(this, 'GuardrailPiiVersion', {
      guardrailIdentifier: guardrail.attrGuardrailId,
      description: 'Desarrollo: anonimiza PII y RUT en entrada y salida',
    });

    new CfnOutput(this, 'BucketCapturas', { value: capturas.bucketName });
    new CfnOutput(this, 'UserPoolId', { value: usuarios.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: clienteWeb.userPoolClientId });
    new CfnOutput(this, 'GuardrailId', { value: guardrail.attrGuardrailId });
    new CfnOutput(this, 'GuardrailVersion', { value: guardrailVersion.attrVersion });
  }
}
