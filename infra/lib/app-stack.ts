import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CfnOutput,
  Duration,
  IgnoreMode,
  RemovalPolicy,
  Stack,
  Tags,
  type StackProps,
} from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import type { Construct } from 'constructs';
import { crearBucketCapturas, crearGuardrail, crearIdentidad } from './componentes.js';
import { NOMBRE_BASE } from './datos-stack.js';

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_WEB = resolve(RAIZ_REPO, 'apps/web/dist');
const DIST_PIPELINE = resolve(RAIZ_REPO, 'apps/pipeline/dist');

/** Prefix list administrada de CloudFront (origin-facing) en us-east-1. */
export const PREFIX_LIST_CLOUDFRONT = 'pl-3b927c52';

export const MODELOS = {
  extraccion: 'us.anthropic.claude-sonnet-5-5',
  resumen: 'us.anthropic.claude-haiku-5-5',
} as const;

/** Prefijo de las capturas que inician el pipeline. */
export const PREFIJO_CAPTURAS = 'capturas/';

/** Web en Amplify Hosting (app dgsos3g6dvh6h, rama main), autorizada para subir capturas. */
export const ORIGEN_WEB_AMPLIFY = 'https://main.dgsos3g6dvh6h.amplifyapp.com';

export interface AppStackProps extends StackProps {
  vpc: ec2.IVpc;
  cluster: rds.DatabaseCluster;
}

/**
 * Aplicación del ambiente de producción: web (S3 + CloudFront), API (Fargate + ALB),
 * pipeline (S3 → EventBridge → Step Functions → Lambda), identidad y Guardrail.
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    Tags.of(this).add('proyecto', 'defensores-del-toqui');
    Tags.of(this).add('evento', 'aws-breaking-barriers-2026');
    Tags.of(this).add('ambiente', 'prod');

    // --- Identidad y Guardrail ---
    const { pool, cliente } = crearIdentidad(this, {
      nombre: 'toqui-prod',
      permitirPassword: false,
    });
    const { guardrail, version } = crearGuardrail(this, {
      nombre: 'toqui-prod-pii',
      descripcionVersion: 'Producción: anonimiza PII y RUT en entrada y salida',
    });

    // --- API: NestJS en Fargate detrás de un ALB que solo acepta tráfico de CloudFront ---
    const secreto = props.cluster.secret;
    if (!secreto) throw new Error('El cluster de Aurora no tiene secreto de credenciales.');

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'toqui-prod',
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });
    const logsApi = new logs.LogGroup(this, 'LogsApi', {
      logGroupName: '/toqui/prod/api',
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Api', {
      cluster,
      serviceName: 'toqui-api',
      loadBalancerName: 'toqui-prod-api',
      publicLoadBalancer: true,
      openListener: false,
      assignPublicIp: true,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      // Con una tarea, levantar la nueva antes de detener la anterior evita cortes al desplegar.
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      healthCheckGracePeriod: Duration.seconds(120),
      circuitBreaker: { rollback: true },
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(RAIZ_REPO, {
          file: 'apps/api/Dockerfile',
          platform: Platform.LINUX_ARM64,
          ignoreMode: IgnoreMode.DOCKER,
        }),
        containerPort: 3000,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup: logsApi }),
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
          AWS_REGION: this.region,
          DB_NAME: NOMBRE_BASE,
          DATABASE_SSL_CA: '/app/rds-ca.pem',
          COGNITO_USER_POOL_ID: pool.userPoolId,
          COGNITO_CLIENT_ID: cliente.userPoolClientId,
          BEDROCK_GUARDRAIL_ID: guardrail.attrGuardrailId,
          BEDROCK_GUARDRAIL_VERSION: version.attrVersion,
          BEDROCK_MODEL_EXTRACCION: MODELOS.extraccion,
          BEDROCK_MODEL_RESUMEN: MODELOS.resumen,
        },
        secrets: {
          DB_HOST: ecs.Secret.fromSecretsManager(secreto, 'host'),
          DB_PORT: ecs.Secret.fromSecretsManager(secreto, 'port'),
          DB_USER: ecs.Secret.fromSecretsManager(secreto, 'username'),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(secreto, 'password'),
        },
      },
    });
    api.targetGroup.configureHealthCheck({ path: '/health', healthyHttpCodes: '200' });
    api.loadBalancer.connections.allowFrom(
      ec2.Peer.prefixList(PREFIX_LIST_CLOUDFRONT),
      ec2.Port.tcp(80),
      'Solo CloudFront',
    );
    api.service.connections.allowTo(props.cluster, ec2.Port.tcp(5432), 'API a Aurora');
    const escalado = api.service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 4 });
    escalado.scaleOnCpuUtilization('Cpu', { targetUtilizationPercent: 60 });

    // --- Web: PWA en S3 privado detrás de CloudFront; /api/* va al ALB ---
    const web = new s3.Bucket(this, 'Web', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    const rutasSpa = new cloudfront.Function(this, 'RutasSpa', {
      functionName: 'toqui-prod-rutas-spa',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var r = event.request; if (r.uri.indexOf('.') === -1) { r.uri = '/index.html'; } return r; }",
      ),
    });
    const prefijoApi = new cloudfront.Function(this, 'PrefijoApi', {
      functionName: 'toqui-prod-prefijo-api',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var r = event.request; r.uri = r.uri.replace(/^\\/api/, '') || '/'; return r; }",
      ),
    });
    const distribucion = new cloudfront.Distribution(this, 'Distribucion', {
      comment: 'Defensores del Toqui: web y API',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(web),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          { function: rutasSpa, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.LoadBalancerV2Origin(api.loadBalancer, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [
            { function: prefijoApi, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
          ],
        },
      },
    });
    new s3deploy.BucketDeployment(this, 'PublicarWeb', {
      // Sin build de la web (por ejemplo en CI) se publica un aviso; el despliegue real compila antes.
      sources: [
        existsSync(DIST_WEB)
          ? s3deploy.Source.asset(DIST_WEB)
          : s3deploy.Source.data('index.html', '<!doctype html><p>Web sin compilar</p>'),
      ],
      destinationBucket: web,
      distribution: distribucion,
      distributionPaths: ['/*'],
    });
    const urlWeb = `https://${distribucion.distributionDomainName}`;

    // --- Capturas: bucket con eventos hacia EventBridge ---
    const capturas = crearBucketCapturas(this, {
      nombre: `toqui-prod-capturas-${this.account}`,
      origenes: [urlWeb, ORIGEN_WEB_AMPLIFY],
      eventBridge: true,
    });

    // --- Pipeline: S3 (capturas/) → EventBridge → Step Functions → Lambda ---
    const paso = new lambda.Function(this, 'PasoEco', {
      functionName: 'toqui-prod-paso-eco',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'eco.handler',
      code: existsSync(DIST_PIPELINE)
        ? lambda.Code.fromAsset(DIST_PIPELINE)
        : lambda.Code.fromInline('exports.handler = async () => ({});'),
      memorySize: 512,
      timeout: Duration.seconds(60),
      logGroup: new logs.LogGroup(this, 'LogsPipeline', {
        logGroupName: '/toqui/prod/pipeline',
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    const maquina = new sfn.StateMachine(this, 'Captura', {
      stateMachineName: 'toqui-captura',
      timeout: Duration.minutes(15),
      definitionBody: sfn.DefinitionBody.fromChainable(
        new tasks.LambdaInvoke(this, 'Procesar captura', {
          lambdaFunction: paso,
          payload: sfn.TaskInput.fromObject({
            idCaptura: sfn.JsonPath.stringAt('$.detail.object.key'),
          }),
          outputPath: '$.Payload',
          retryOnServiceExceptions: true,
        }).next(new sfn.Succeed(this, 'Borrador listo')),
      ),
    });
    new events.Rule(this, 'CapturaSubida', {
      ruleName: 'toqui-prod-captura-subida',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [capturas.bucketName] },
          object: { key: [{ prefix: PREFIJO_CAPTURAS }] },
        },
      },
      targets: [new targets.SfnStateMachine(maquina)],
    });

    // --- Permisos de IA para la API y el pipeline ---
    const permisosIa = [
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/anthropic.*',
          'arn:aws:bedrock:*::foundation-model/amazon.nova-*',
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: ['bedrock:ApplyGuardrail'],
        resources: [guardrail.attrGuardrailArn],
      }),
      new iam.PolicyStatement({
        actions: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'],
        resources: ['*'],
      }),
    ];
    for (const declaracion of permisosIa) {
      api.taskDefinition.addToTaskRolePolicy(declaracion);
      paso.addToRolePolicy(declaracion);
    }
    capturas.grantReadWrite(api.taskDefinition.taskRole);
    capturas.grantRead(paso);
    api.taskDefinition.defaultContainer?.addEnvironment('S3_BUCKET_CAPTURAS', capturas.bucketName);

    new CfnOutput(this, 'WebUrl', { value: urlWeb });
    new CfnOutput(this, 'AlbDns', { value: api.loadBalancer.loadBalancerDnsName });
    new CfnOutput(this, 'BucketCapturas', { value: capturas.bucketName });
    new CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: cliente.userPoolClientId });
    new CfnOutput(this, 'GuardrailId', { value: guardrail.attrGuardrailId });
    new CfnOutput(this, 'GuardrailVersion', { value: version.attrVersion });
    new CfnOutput(this, 'StateMachineArn', { value: maquina.stateMachineArn });
  }
}
