import { CfnOutput, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { crearBucketCapturas, crearGuardrail, crearIdentidad } from './componentes.js';

export { PATRON_RUT } from './componentes.js';

/** Origen de la web en desarrollo local, autorizado para subir con URL prefirmada. */
export const ORIGEN_WEB_LOCAL = 'http://localhost:5173';

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

    const capturas = crearBucketCapturas(this, {
      nombre: `toqui-dev-capturas-${this.account}`,
      origenes: [ORIGEN_WEB_LOCAL],
    });
    const { pool, cliente } = crearIdentidad(this, { nombre: 'toqui-dev', permitirPassword: true });
    const { guardrail, version } = crearGuardrail(this, {
      nombre: 'toqui-dev-pii',
      descripcionVersion: 'Desarrollo: anonimiza PII y RUT en entrada y salida',
    });

    new CfnOutput(this, 'BucketCapturas', { value: capturas.bucketName });
    new CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: cliente.userPoolClientId });
    new CfnOutput(this, 'GuardrailId', { value: guardrail.attrGuardrailId });
    new CfnOutput(this, 'GuardrailVersion', { value: version.attrVersion });
  }
}
