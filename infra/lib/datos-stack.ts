import { CfnOutput, Duration, RemovalPolicy, Stack, Tags, type StackProps } from 'aws-cdk-lib';
import type * as ec2 from 'aws-cdk-lib/aws-ec2';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import type { Construct } from 'constructs';

export const NOMBRE_BASE = 'toqui';

/** Aurora Serverless v2 (PostgreSQL) en subredes aisladas, con credenciales en Secrets Manager. */
export class DatosStack extends Stack {
  readonly cluster: rds.DatabaseCluster;

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
      // Sin caracteres que haya que escapar en la URL de conexión.
      credentials: rds.Credentials.fromGeneratedSecret('toqui_admin', {
        secretName: 'toqui-prod/aurora',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\,=^.-',
      }),
      storageEncrypted: true,
      backup: { retention: Duration.days(1) },
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new CfnOutput(this, 'ClusterEndpoint', { value: this.cluster.clusterEndpoint.hostname });
    new CfnOutput(this, 'SecretoAurora', { value: this.cluster.secret?.secretName ?? '' });
  }
}
