import { Stack, Tags, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

/**
 * Red del ambiente de producción: subredes públicas (API en Fargate con IP pública) y
 * aisladas (Aurora, sin salida a internet). Sin NAT Gateway.
 */
export class RedStack extends Stack {
  readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    Tags.of(this).add('proyecto', 'defensores-del-toqui');
    Tags.of(this).add('ambiente', 'prod');

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: 'toqui-prod',
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'publica', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'datos', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
  }
}
