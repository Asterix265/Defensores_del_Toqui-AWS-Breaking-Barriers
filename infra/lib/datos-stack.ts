import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

export const NOMBRE_BASE = 'toqui';

/** Usuario de la API: sin DDL; lo crea el contenedor de migraciones (endurecer-seguridad-aws, D5). */
export const USUARIO_APP = 'toqui_app';

/** Sin caracteres que haya que escapar en la URL de conexión ni en el SQL. */
const EXCLUIR_PASSWORD = ' %+~`#$&*()|[]{}:;<>?!\'/@"\\,=^.-';

/** Aurora Serverless v2 (PostgreSQL) en subredes aisladas, con credenciales en Secrets Manager. */
export class DatosStack extends Stack {
  readonly cluster: rds.DatabaseCluster;
  /** Credenciales de `toqui_app`, con `host` y `port` del cluster. */
  readonly secretoApp: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: StackProps & { vpc: ec2.IVpc }) {
    super(scope, id, props);
    Tags.of(this).add('proyecto', 'defensores-del-toqui');
    Tags.of(this).add('ambiente', 'prod');

    this.cluster = new rds.DatabaseCluster(this, 'Aurora', {
      clusterIdentifier: 'toqui-prod',
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_9,
      }),
      writer: rds.ClusterInstance.serverlessV2('Escritor'),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      vpc: props.vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      defaultDatabaseName: NOMBRE_BASE,
      credentials: rds.Credentials.fromGeneratedSecret('toqui_admin', {
        secretName: 'toqui-prod/aurora',
        excludeCharacters: EXCLUIR_PASSWORD,
      }),
      storageEncrypted: true,
      backup: { retention: Duration.days(1) },
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.secretoApp = new rds.DatabaseSecret(this, 'SecretoApp', {
      username: USUARIO_APP,
      secretName: 'toqui-prod/aurora-app',
      dbname: NOMBRE_BASE,
      excludeCharacters: EXCLUIR_PASSWORD,
    }).attach(this.cluster);

    new CfnOutput(this, 'ClusterEndpoint', { value: this.cluster.clusterEndpoint.hostname });
    new CfnOutput(this, 'SecretoAurora', { value: this.cluster.secret?.secretName ?? '' });
    new CfnOutput(this, 'SecretoAuroraApp', { value: 'toqui-prod/aurora-app' });
  }
}
