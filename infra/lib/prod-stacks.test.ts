import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, it } from 'vitest';
import {
  AppStack,
  ORIGEN_WEB_AMPLIFY,
  PREFIJO_CAPTURAS,
  PREFIX_LIST_CLOUDFRONT,
} from './app-stack.js';
import { DatosStack } from './datos-stack.js';
import { RedStack } from './red-stack.js';

describe('stacks de producción', () => {
  let red: Template;
  let datos: Template;
  let app: Template;

  beforeAll(() => {
    const raiz = new App();
    const env = { account: '111111111111', region: 'us-east-1' };
    const r = new RedStack(raiz, 'Red', { env });
    const d = new DatosStack(raiz, 'Datos', { env, vpc: r.vpc });
    const a = new AppStack(raiz, 'Aplicacion', { env, vpc: r.vpc, cluster: d.cluster });
    red = Template.fromStack(r);
    datos = Template.fromStack(d);
    app = Template.fromStack(a);
  }, 120_000);

  it('crea la VPC sin NAT Gateway', () => {
    red.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  it('crea Aurora Serverless v2 cifrado en PostgreSQL 17', () => {
    datos.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      EngineVersion: Match.stringLikeRegexp('^17\\.'),
      StorageEncrypted: true,
      ServerlessV2ScalingConfiguration: { MinCapacity: 0.5, MaxCapacity: 4 },
    });
  });

  it('corre la API en Fargate ARM64 con credenciales desde Secrets Manager', () => {
    app.hasResourceProperties('AWS::ECS::TaskDefinition', {
      RuntimePlatform: { CpuArchitecture: 'ARM64', OperatingSystemFamily: 'LINUX' },
      ContainerDefinitions: [
        Match.objectLike({
          Secrets: Match.arrayWith([Match.objectLike({ Name: 'DB_PASSWORD' })]),
        }),
      ],
    });
  });

  it('solo deja entrar al ALB desde CloudFront', () => {
    app.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
      SourcePrefixListId: PREFIX_LIST_CLOUDFRONT,
      FromPort: 80,
    });
    // El listener no queda abierto a 0.0.0.0/0.
    const abiertos = app.findResources('AWS::EC2::SecurityGroup', {
      Properties: {
        SecurityGroupIngress: Match.arrayWith([Match.objectLike({ CidrIp: '0.0.0.0/0' })]),
      },
    });
    if (Object.keys(abiertos).length > 0) throw new Error('Hay un grupo de seguridad abierto');
  });

  it('sirve la web y /api/* desde la misma distribución', () => {
    app.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: [Match.objectLike({ PathPattern: '/api/*' })],
      }),
    });
  });

  it('acepta subidas de capturas desde la web en Amplify', () => {
    app.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [Match.objectLike({ AllowedOrigins: Match.arrayWith([ORIGEN_WEB_AMPLIFY]) })],
      },
    });
  });

  it('inicia el pipeline cuando llega una captura', () => {
    app.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: Match.objectLike({
        detail: Match.objectLike({ object: { key: [{ prefix: PREFIJO_CAPTURAS }] } }),
      }),
    });
    app.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
  });
});
