import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

/** Único origen de despliegues automáticos: la rama `main` de este repositorio. */
export const REPO_GITHUB = 'Asterix265/Defensores_del_Toqui-AWS-Breaking-Barriers';
export const RAMA_DESPLIEGUE = 'main';
/**
 * El repositorio usa el `sub` inmutable de OIDC (`use_immutable_subject`): lleva los ids del dueño y
 * del repositorio, así que renombrarlos o recrearlos con el mismo nombre no da acceso. Ver
 * `gh api repos/<repo>/actions/oidc/customization/sub`.
 */
export const SUB_GITHUB = `repo:Asterix265@94083287/Defensores_del_Toqui-AWS-Breaking-Barriers@1419528574:ref:refs/heads/${RAMA_DESPLIEGUE}`;
export const ROL_DESPLIEGUE = 'toqui-github-deploy';

const PROVEEDOR_GITHUB = 'token.actions.githubusercontent.com';
/** Calificador del bootstrap de CDK (por defecto): nombra sus roles. */
const CALIFICADOR_CDK = 'hnb659fds';

/**
 * Identidad de GitHub Actions para desplegar producción (despliegue-continuo, D3): proveedor
 * OIDC y un rol que solo puede asumir `main`. El rol no despliega por sí mismo: asume los roles
 * del bootstrap de CDK, y CloudFormation ejecuta con `cfn-exec-role` (AdministratorAccess), así
 * que quien puede hacer push a `main` puede cambiar cualquier recurso de la cuenta.
 * Los ARN se arman con nombres fijos para no crear referencias entre stacks.
 */
export class CiCdStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const proveedor = new iam.OidcProviderNative(this, 'ProveedorGitHub', {
      url: `https://${PROVEEDOR_GITHUB}`,
      clientIds: ['sts.amazonaws.com'],
    });

    const rol = new iam.Role(this, 'RolDespliegue', {
      roleName: ROL_DESPLIEGUE,
      description: `GitHub Actions (${REPO_GITHUB}, ${RAMA_DESPLIEGUE}) despliega producción con CDK`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(proveedor.oidcProviderArn, {
        StringEquals: {
          [`${PROVEEDOR_GITHUB}:aud`]: 'sts.amazonaws.com',
          [`${PROVEEDOR_GITHUB}:sub`]: SUB_GITHUB,
        },
      }),
    });

    const arn = (servicio: string, recurso: string, region = this.region) =>
      `arn:${this.partition}:${servicio}:${region}:${this.account}:${recurso}`;

    // CDK publica los assets y despliega asumiendo los roles del bootstrap.
    rol.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole', 'sts:TagSession'],
        resources: ['deploy', 'file-publishing', 'image-publishing', 'lookup'].map((tipo) =>
          arn('iam', `role/cdk-${CALIFICADOR_CDK}-${tipo}-role-${this.account}-${this.region}`, ''),
        ),
      }),
    );
    // Estado del bootstrap y salidas de los stacks (cdk y smoke).
    rol.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [
          arn('cloudformation', 'stack/CDKToolkit/*'),
          arn('cloudformation', 'stack/Toqui*/*'),
        ],
      }),
    );
    // Smoke de producción (infra/scripts/smoke-prod.ts, paso 5).
    rol.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [arn('sqs', 'toqui-prod-capturas')],
      }),
    );
    rol.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:FilterLogEvents'],
        resources: [arn('logs', 'log-group:/toqui/prod/proceso:*')],
      }),
    );

    new CfnOutput(this, 'RolDespliegueArn', { value: rol.roleArn });
  }
}
