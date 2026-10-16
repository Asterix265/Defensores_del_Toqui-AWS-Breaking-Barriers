import { readFileSync } from 'node:fs';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  AppStack,
  CONCURRENCIA_PROCESO,
  IA_PROVIDER_PROCESO,
  MAX_INTENTOS_PROCESO,
  MODELOS,
  ORIGEN_WEB_AMPLIFY,
  PREFIJO_DATASET,
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
    const a = new AppStack(raiz, 'Aplicacion', {
      env,
      vpc: r.vpc,
      cluster: d.cluster,
      secretoApp: d.secretoApp,
    });
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
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Secrets: Match.arrayWith([Match.objectLike({ Name: 'DB_PASSWORD' })]),
        }),
      ]),
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

  it('deja el ALB interno y CloudFront llega a él por un VPC Origin', () => {
    app.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Name: 'toqui-prod-api-int',
      Scheme: 'internal',
    });
    app.resourceCountIs('AWS::CloudFront::VpcOrigin', 1);
    app.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Origins: [Match.objectLike({ VpcOriginConfig: Match.anyValue() })],
        CacheBehaviors: [Match.objectLike({ PathPattern: '/api/*' })],
      }),
    });
  });

  it('no publica la web: CloudFront solo sirve la API (la web está en Amplify)', () => {
    app.resourceCountIs('Custom::CDKBucketDeployment', 0);
    // El único bucket es el de capturas.
    app.resourceCountIs('AWS::S3::Bucket', 1);
  });

  it('acepta subidas de capturas solo desde la web en Amplify', () => {
    app.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [Match.objectLike({ AllowedOrigins: [ORIGEN_WEB_AMPLIFY] })],
      },
    });
  });

  it('la API solo sale por HTTPS a internet y por 5432 a Aurora', () => {
    app.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: Match.stringLikeRegexp('^API'),
      SecurityGroupEgress: [
        Match.objectLike({ CidrIp: '0.0.0.0/0', IpProtocol: 'tcp', FromPort: 443, ToPort: 443 }),
      ],
    });
    app.hasResourceProperties('AWS::EC2::SecurityGroupEgress', {
      IpProtocol: 'tcp',
      FromPort: 5432,
      ToPort: 5432,
    });
  });

  it('el rol de la API no borra en S3 ni invoca Bedrock', () => {
    const politicas = app.findResources('AWS::IAM::Policy', {
      Properties: { Roles: [{ Ref: Match.stringLikeRegexp('^ApiTaskDefTaskRole') }] },
    });
    const texto = JSON.stringify(politicas);
    if (Object.keys(politicas).length !== 1)
      throw new Error('No se encontró la política de la API');
    for (const prohibido of ['s3:DeleteObject', 's3:*', 'bedrock:', 'transcripciones']) {
      if (texto.includes(prohibido)) throw new Error(`La API tiene ${prohibido}`);
    }
    for (const requerido of ['s3:PutObject', 's3:GetObject', 's3:ListBucket', '/capturas/*']) {
      if (!texto.includes(requerido)) throw new Error(`A la API le falta ${requerido}`);
    }
  });

  it('el rol de la API solo lee el prefijo dataset/ (carga con `aws:prod:seed`)', () => {
    const politicas = app.findResources('AWS::IAM::Policy', {
      Properties: { Roles: [{ Ref: Match.stringLikeRegexp('^ApiTaskDefTaskRole') }] },
    });
    const [politica] = Object.values(politicas) as {
      Properties: {
        PolicyDocument: { Statement: { Action: string | string[]; Resource: unknown }[] };
      };
    }[];
    const dataset = politica!.Properties.PolicyDocument.Statement.filter((s) =>
      JSON.stringify(s.Resource).includes('/dataset/*'),
    );
    if (dataset.length !== 1 || dataset[0]!.Action !== 's3:GetObject') {
      throw new Error(`Permisos sobre dataset/: ${JSON.stringify(dataset)}`);
    }
    // `aws:prod:seed` se niega a lanzar la carga si el stack desplegado no expone esta salida.
    app.hasOutput('PrefijoDataset', { Value: PREFIJO_DATASET });
  });

  it('migra con el administrador en un contenedor previo y la API usa toqui_app', () => {
    const [tarea] = Object.values(app.findResources('AWS::ECS::TaskDefinition'));
    const contenedores = (
      tarea as {
        Properties: {
          ContainerDefinitions: {
            Name: string;
            Essential?: boolean;
            DependsOn?: { ContainerName: string; Condition: string }[];
            Environment?: { Name: string; Value: unknown }[];
            Secrets?: { Name: string; ValueFrom: unknown }[];
          }[];
        };
      }
    ).Properties.ContainerDefinitions;
    const migraciones = contenedores.find((c) => c.Name === 'migraciones');
    const apiWeb = contenedores.find((c) => c.Name !== 'migraciones');
    if (!migraciones || !apiWeb) throw new Error('Faltan contenedores');
    if (migraciones.Essential !== false) throw new Error('migraciones debe ser no esencial');
    if (
      JSON.stringify(apiWeb.DependsOn) !== '[{"Condition":"SUCCESS","ContainerName":"migraciones"}]'
    )
      throw new Error(`La API no espera a migraciones: ${JSON.stringify(apiWeb.DependsOn)}`);
    if (!apiWeb.Environment?.some((e) => e.Name === 'RUN_MIGRATIONS' && e.Value === 'false'))
      throw new Error('La API no debe migrar');
    // Solo `migraciones` recibe el secreto del administrador (el adjunto de ToquiDatos).
    const admin = /AuroraSecretAttachment/;
    if (admin.test(JSON.stringify(apiWeb.Secrets)))
      throw new Error('La API recibe el administrador');
    if (!admin.test(JSON.stringify(migraciones.Secrets))) throw new Error('migraciones sin admin');
    if (!/SecretoApp/.test(JSON.stringify(apiWeb.Secrets))) throw new Error('La API sin toqui_app');
  });

  it('crea el secreto de toqui_app adjunto al cluster', () => {
    datos.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'toqui-prod/aurora-app',
      GenerateSecretString: Match.objectLike({
        SecretStringTemplate: '{"username":"toqui_app","dbname":"toqui"}',
      }),
    });
    datos.resourceCountIs('AWS::SecretsManager::SecretTargetAttachment', 2);
  });

  it('procesa las capturas desde una cola con DLQ y sin Step Functions', () => {
    app.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'toqui-prod-capturas',
      VisibilityTimeout: 1080,
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
      Timeout: 180,
      Environment: {
        Variables: Match.objectLike({
          PIPELINE_TOKEN_SECRETO: Match.anyValue(),
          IA_PROVIDER: IA_PROVIDER_PROCESO,
          MODELO_EXTRACCION: MODELOS.extraccion,
          LECTOR_FOTO: 'textract',
          MAX_INTENTOS: String(MAX_INTENTOS_PROCESO),
        }),
      },
    });
  });

  it('la Lambda de proceso clasifica con Claude (bedrock) desde la prueba en vivo', () => {
    // Volver a la clasificación simulada es cambiar esta constante a 'fake' (y esta prueba).
    expect(IA_PROVIDER_PROCESO).toBe('bedrock');
    app.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'toqui-prod-proceso',
      Environment: { Variables: Match.objectLike({ IA_PROVIDER: 'bedrock' }) },
    });
  });

  it('cambiar de proveedor es un cambio de una línea: la constante solo fija IA_PROVIDER', () => {
    // Una `const` no se puede cambiar desde la prueba: se comprueba que su único uso es la
    // variable de la Lambda, así cambiarla no altera nada más del stack.
    const codigo = readFileSync(new URL('./app-stack.ts', import.meta.url), 'utf8');
    expect(codigo.match(/\bIA_PROVIDER_PROCESO\b/g)).toHaveLength(2);
    expect(codigo).toContain("export const IA_PROVIDER_PROCESO: 'fake' | 'bedrock' = 'bedrock';");
    expect(codigo).toContain('IA_PROVIDER: IA_PROVIDER_PROCESO,');
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
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Secrets: Match.arrayWith([Match.objectLike({ Name: 'PIPELINE_TOKEN' })]),
          Environment: Match.arrayWith([Match.objectLike({ Name: 'SQS_URL_CAPTURAS' })]),
        }),
      ]),
    });
    const plantilla = JSON.stringify(app.toJSON());
    if (plantilla.includes('"PIPELINE_TOKEN","Value"')) throw new Error('Token en texto plano');
  });

  it('la API encola las capturas en SQS (PIPELINE_MODE=cola) con permiso de envío', () => {
    app.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([{ Name: 'PIPELINE_MODE', Value: 'cola' }]),
        }),
      ]),
    });
    const politicas = JSON.stringify(app.findResources('AWS::IAM::Policy'));
    if (!politicas.includes('sqs:SendMessage')) throw new Error('La API no puede enviar a la cola');
  });
});
