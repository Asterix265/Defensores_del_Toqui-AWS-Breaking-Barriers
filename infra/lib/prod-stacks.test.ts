import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, it } from 'vitest';
import {
  AppStack,
  CONCURRENCIA_PROCESO,
  MAX_INTENTOS_PROCESO,
  ORIGEN_WEB_AMPLIFY,
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

  it('procesa las capturas desde una cola con DLQ y sin Step Functions', () => {
    app.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'toqui-prod-capturas',
      VisibilityTimeout: 720,
      RedrivePolicy: Match.objectLike({ maxReceiveCount: MAX_INTENTOS_PROCESO }),
    });
    app.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'toqui-prod-capturas-dlq',
      MessageRetentionPeriod: 14 * 24 * 3600,
    });
    app.resourceCountIs('AWS::StepFunctions::StateMachine', 0);
    app.resourceCountIs('AWS::Events::Rule', 0);
  });

  it('activa la Lambda de proceso de a un mensaje, con concurrencia acotada', () => {
    app.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 1,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
      ScalingConfig: { MaximumConcurrency: CONCURRENCIA_PROCESO },
    });
    app.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'toqui-prod-proceso',
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Timeout: 120,
      Environment: {
        Variables: Match.objectLike({
          PIPELINE_TOKEN_SECRETO: Match.anyValue(),
          LECTOR_FOTO: 'textract',
          MAX_INTENTOS: String(MAX_INTENTOS_PROCESO),
        }),
      },
    });
  });

  it('da a la Lambda Transcribe, Textract y el Guardrail', () => {
    app.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: 'bedrock:ApplyGuardrail' }),
          Match.objectLike({
            Action: [
              'transcribe:StartTranscriptionJob',
              'transcribe:GetTranscriptionJob',
              'textract:DetectDocumentText',
            ],
          }),
        ]),
      },
    });
  });

  it('comparte el token del pipeline por Secrets Manager y no en texto plano', () => {
    app.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        Match.objectLike({
          Secrets: Match.arrayWith([Match.objectLike({ Name: 'PIPELINE_TOKEN' })]),
          Environment: Match.arrayWith([Match.objectLike({ Name: 'SQS_URL_CAPTURAS' })]),
        }),
      ],
    });
    const plantilla = JSON.stringify(app.toJSON());
    if (plantilla.includes('"PIPELINE_TOKEN","Value"')) throw new Error('Token en texto plano');
  });

  it('la API encola las capturas en SQS (PIPELINE_MODE=cola) con permiso de envío', () => {
    app.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        Match.objectLike({
          Environment: Match.arrayWith([{ Name: 'PIPELINE_MODE', Value: 'cola' }]),
        }),
      ],
    });
    const politicas = JSON.stringify(app.findResources('AWS::IAM::Policy'));
    if (!politicas.includes('sqs:SendMessage')) throw new Error('La API no puede enviar a la cola');
  });
});
