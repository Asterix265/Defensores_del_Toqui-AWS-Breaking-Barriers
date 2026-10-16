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
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { crearBucketCapturas, crearGuardrail, crearIdentidad } from './componentes.js';
import { NOMBRE_BASE } from './datos-stack.js';

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST_PIPELINE = resolve(RAIZ_REPO, 'apps/pipeline/dist');

/** Prefix list administrada de CloudFront (origin-facing) en us-east-1. */
export const PREFIX_LIST_CLOUDFRONT = 'pl-3b927c52';

/**
 * Perfiles de inferencia de Claude. La cuenta del evento tiene una lista de modelos permitidos
 * (`ws-bedrock-model-allowlist-policy-1`): Sonnet 5 está permitido; Sonnet 5.5 y Haiku 5.5 no
 * (comprobado el 16-10-2026 con `clasificador.live.test.ts`).
 */
export const MODELOS = {
  extraccion: 'us.anthropic.claude-sonnet-5',
  resumen: 'us.anthropic.claude-haiku-5-5',
} as const;

/** Proveedor de IA de la Lambda de proceso. Pasar a 'bedrock' solo tras la prueba en vivo. */
export const IA_PROVIDER_PROCESO: 'fake' | 'bedrock' = 'fake';

/** Prefijo de los archivos de captura (audio y foto) en el bucket. */
export const PREFIJO_CAPTURAS = 'capturas/';
/** CSV que sube `pnpm aws:prod:seed` para la tarea de carga (migrar-dataset-nucleos, D4). */
export const PREFIJO_DATASET = 'dataset/';

/** Intentos por trabajo antes de pasar a la DLQ; la Lambda informa el error en el último (D4). */
export const MAX_INTENTOS_PROCESO = 3;

/** Trabajos simultáneos de la Lambda de proceso, para no superar las cuotas de Bedrock (D4). */
export const CONCURRENCIA_PROCESO = 5;

/** Web en Amplify Hosting (app dgsos3g6dvh6h, rama main), autorizada para subir capturas. */
export const ORIGEN_WEB_AMPLIFY = 'https://main.dgsos3g6dvh6h.amplifyapp.com';

export interface AppStackProps extends StackProps {
  vpc: ec2.IVpc;
  cluster: rds.DatabaseCluster;
  /** Credenciales de `toqui_app` (sin DDL) para la API. */
  secretoApp: secretsmanager.ISecret;
}

/**
 * Aplicación del ambiente de producción: API (CloudFront → ALB interno → Fargate),
 * procesamiento (API → SQS → Lambda → API), identidad y Guardrail. La web está en Amplify.
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

    // --- API: NestJS en Fargate detrás de un ALB interno; solo CloudFront llega a él ---
    const secretoAdmin = props.cluster.secret;
    if (!secretoAdmin) throw new Error('El cluster de Aurora no tiene secreto de credenciales.');

    // Secreto compartido del endpoint interno: la API lo exige y la Lambda lo presenta (D12).
    const tokenPipeline = new secretsmanager.Secret(this, 'TokenPipeline', {
      secretName: 'toqui/prod/pipeline-token',
      description: 'PIPELINE_TOKEN: autoriza a la Lambda de proceso en /interno/capturas',
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

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

    // Sin NAT, la tarea sale a internet por su IP pública; el SG solo permite HTTPS y Aurora (D4).
    const sgApi = new ec2.SecurityGroup(this, 'SgApi', {
      vpc: props.vpc,
      description: 'API: entrada desde el ALB; salida HTTPS y Aurora',
      allowAllOutbound: false,
    });
    sgApi.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS a servicios de AWS y Cognito',
    );

    const imagenApi = ecs.ContainerImage.fromAsset(RAIZ_REPO, {
      file: 'apps/api/Dockerfile',
      platform: Platform.LINUX_ARM64,
      ignoreMode: IgnoreMode.DOCKER,
    });

    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Api', {
      cluster,
      serviceName: 'toqui-api',
      // Interno (D1): cambiar el esquema reemplaza el ALB, que necesita un nombre nuevo.
      loadBalancerName: 'toqui-prod-api-int',
      publicLoadBalancer: false,
      openListener: false,
      assignPublicIp: true,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [sgApi],
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
        image: imagenApi,
        containerPort: 3000,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup: logsApi }),
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
          AWS_REGION: this.region,
          DB_NAME: NOMBRE_BASE,
          DATABASE_SSL_CA: '/app/rds-ca.pem',
          // Las aplica el contenedor `migraciones` con el administrador (D5).
          RUN_MIGRATIONS: 'false',
          COGNITO_USER_POOL_ID: pool.userPoolId,
          COGNITO_CLIENT_ID: cliente.userPoolClientId,
        },
        secrets: {
          DB_HOST: ecs.Secret.fromSecretsManager(props.secretoApp, 'host'),
          DB_PORT: ecs.Secret.fromSecretsManager(props.secretoApp, 'port'),
          DB_USER: ecs.Secret.fromSecretsManager(props.secretoApp, 'username'),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(props.secretoApp, 'password'),
          PIPELINE_TOKEN: ecs.Secret.fromSecretsManager(tokenPipeline),
        },
      },
    });
    api.targetGroup.configureHealthCheck({ path: '/health', healthyHttpCodes: '200' });

    // Migraciones y usuario `toqui_app` antes de cada arranque de la API, con el administrador:
    // sus credenciales solo llegan a este contenedor, que termina antes de que arranque la API (D5).
    const migraciones = api.taskDefinition.addContainer('Migraciones', {
      containerName: 'migraciones',
      image: imagenApi,
      essential: false,
      command: ['node', 'docker-entrypoint.mjs', '--migrar'],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'migraciones', logGroup: logsApi }),
      environment: {
        NODE_ENV: 'production',
        DB_NAME: NOMBRE_BASE,
        DATABASE_SSL_CA: '/app/rds-ca.pem',
      },
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(secretoAdmin, 'host'),
        DB_PORT: ecs.Secret.fromSecretsManager(secretoAdmin, 'port'),
        DB_USER: ecs.Secret.fromSecretsManager(secretoAdmin, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(secretoAdmin, 'password'),
        APP_DB_USER: ecs.Secret.fromSecretsManager(props.secretoApp, 'username'),
        APP_DB_PASSWORD: ecs.Secret.fromSecretsManager(props.secretoApp, 'password'),
      },
    });
    api.taskDefinition.defaultContainer?.addContainerDependencies({
      container: migraciones,
      condition: ecs.ContainerDependencyCondition.SUCCESS,
    });

    // VPC Origin (D1): CloudFront llega al ALB interno por la red de AWS. Con el ALB sin IP
    // pública, la prefix list solo deja pasar a las distribuciones que usan este VPC Origin.
    api.loadBalancer.connections.allowFrom(
      ec2.Peer.prefixList(PREFIX_LIST_CLOUDFRONT),
      ec2.Port.tcp(80),
      'Solo CloudFront',
    );
    api.service.connections.allowTo(props.cluster, ec2.Port.tcp(5432), 'API a Aurora');
    const escalado = api.service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 4 });
    escalado.scaleOnCpuUtilization('Cpu', { targetUtilizationPercent: 60 });

    // --- CloudFront: entrada HTTPS de la API (la web está en Amplify, que reenvía /api/* aquí) ---
    const comportamientoApi: cloudfront.BehaviorOptions = {
      origin: origins.VpcOrigin.withApplicationLoadBalancer(api.loadBalancer, {
        vpcOriginName: 'toqui-prod-api',
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    };
    const prefijoApi = new cloudfront.Function(this, 'PrefijoApi', {
      functionName: 'toqui-prod-prefijo-api',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        "function handler(event) { var r = event.request; r.uri = r.uri.replace(/^\\/api/, '') || '/'; return r; }",
      ),
    });
    const distribucion = new cloudfront.Distribution(this, 'Distribucion', {
      comment: 'Defensores del Toqui: API',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: comportamientoApi,
      additionalBehaviors: {
        '/api/*': {
          ...comportamientoApi,
          functionAssociations: [
            { function: prefijoApi, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
          ],
        },
      },
    });
    const urlCloudFront = `https://${distribucion.distributionDomainName}`;

    // --- Capturas: bucket privado (audio, foto y transcripciones), borrado a los 7 días ---
    const capturas = crearBucketCapturas(this, {
      nombre: `toqui-prod-capturas-${this.account}`,
      origenes: [ORIGEN_WEB_AMPLIFY],
    });

    // --- Procesamiento: API → SQS → Lambda `proceso` → /interno/capturas de la API (D4) ---
    const colaErrores = new sqs.Queue(this, 'ColaCapturasDlq', {
      queueName: 'toqui-prod-capturas-dlq',
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
    });
    // Audio: hasta 90 s de Transcribe, el Guardrail y hasta dos llamadas a Claude de 60 s.
    const timeoutProceso = Duration.seconds(180);
    const cola = new sqs.Queue(this, 'ColaCapturas', {
      queueName: 'toqui-prod-capturas',
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      // AWS recomienda 6 veces el timeout de la función.
      visibilityTimeout: Duration.seconds(timeoutProceso.toSeconds() * 6),
      deadLetterQueue: { queue: colaErrores, maxReceiveCount: MAX_INTENTOS_PROCESO },
    });

    const compilado = existsSync(DIST_PIPELINE);
    const proceso = new lambda.Function(this, 'Proceso', {
      functionName: 'toqui-prod-proceso',
      description: 'Normaliza (Transcribe/Textract), anonimiza, clasifica y entrega el borrador',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      // Sin build (por ejemplo en CI) se sintetiza una función que falla: los mensajes no se pierden.
      handler: compilado ? 'proceso.handler' : 'index.handler',
      code: compilado
        ? lambda.Code.fromAsset(DIST_PIPELINE)
        : lambda.Code.fromInline(
            "exports.handler = async () => { throw new Error('Pipeline sin compilar'); };",
          ),
      memorySize: 1024,
      timeout: timeoutProceso,
      environment: {
        API_URL: `${urlCloudFront}/api`,
        PIPELINE_TOKEN_SECRETO: tokenPipeline.secretArn,
        BUCKET_CAPTURAS: capturas.bucketName,
        GUARDRAIL_ID: guardrail.attrGuardrailId,
        GUARDRAIL_VERSION: version.attrVersion,
        IA_PROVIDER: IA_PROVIDER_PROCESO,
        MODELO_EXTRACCION: MODELOS.extraccion,
        LECTOR_FOTO: 'textract',
        TRANSCRIBE_IDIOMA: 'es-US',
        MAX_INTENTOS: String(MAX_INTENTOS_PROCESO),
        NODE_OPTIONS: '--enable-source-maps',
      },
      logGroup: new logs.LogGroup(this, 'LogsProceso', {
        logGroupName: '/toqui/prod/proceso',
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    proceso.addEventSource(
      new SqsEventSource(cola, {
        batchSize: 1,
        reportBatchItemFailures: true,
        maxConcurrency: CONCURRENCIA_PROCESO,
      }),
    );

    // --- Permisos (D12; endurecer-seguridad-aws D3) ---
    // Solo la Lambda usa Bedrock: la API no invoca modelos.
    proceso.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/anthropic.*',
          'arn:aws:bedrock:*::foundation-model/amazon.nova-*',
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
        ],
      }),
    );
    proceso.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:ApplyGuardrail'],
        resources: [guardrail.attrGuardrailArn],
      }),
    );
    // Transcribe y Textract leen el archivo (y Transcribe escribe su resultado) con los permisos
    // de quien los llama. Ninguno de los dos admite restringir el recurso.
    proceso.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'transcribe:StartTranscriptionJob',
          'transcribe:GetTranscriptionJob',
          'textract:DetectDocumentText',
        ],
        resources: ['*'],
      }),
    );
    capturas.grantRead(proceso, `${PREFIJO_CAPTURAS}*`);
    capturas.grantRead(proceso, 'transcripciones/*');
    capturas.grantPut(proceso, 'transcripciones/*');
    tokenPipeline.grantRead(proceso);

    // La API firma subidas y lecturas y comprueba archivos con HeadObject, sin borrar ni tocar
    // `transcripciones/`. ListBucket hace que un archivo ausente dé 404 (no 403) y permite HeadBucket.
    api.taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [capturas.arnForObjects(`${PREFIJO_CAPTURAS}*`)],
      }),
    );
    api.taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({ actions: ['s3:ListBucket'], resources: [capturas.bucketArn] }),
    );
    // La tarea única de carga (misma definición, `--cargar-dataset`) lee el dataset subido a
    // `dataset/`, que el ciclo de vida del bucket borra a los 7 días.
    api.taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [capturas.arnForObjects(`${PREFIJO_DATASET}*`)],
      }),
    );
    cola.grantSendMessages(api.taskDefinition.taskRole);
    api.taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ['sqs:GetQueueAttributes'],
        resources: [cola.queueArn],
      }),
    );
    // La API encola cada captura; la Lambda de proceso la procesa y entrega el borrador (D1).
    api.taskDefinition.defaultContainer?.addEnvironment('S3_BUCKET_CAPTURAS', capturas.bucketName);
    api.taskDefinition.defaultContainer?.addEnvironment('PIPELINE_MODE', 'cola');
    api.taskDefinition.defaultContainer?.addEnvironment('SQS_URL_CAPTURAS', cola.queueUrl);

    // `WebUrl` conserva su nombre: la leen `pnpm aws:prod:amplify` y el smoke. Es la entrada de la API.
    new CfnOutput(this, 'WebUrl', { value: urlCloudFront });
    new CfnOutput(this, 'AlbDns', { value: api.loadBalancer.loadBalancerDnsName });
    new CfnOutput(this, 'BucketCapturas', { value: capturas.bucketName });
    new CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: cliente.userPoolClientId });
    new CfnOutput(this, 'GuardrailId', { value: guardrail.attrGuardrailId });
    new CfnOutput(this, 'GuardrailVersion', { value: version.attrVersion });
    new CfnOutput(this, 'ColaCapturasUrl', { value: cola.queueUrl });
    new CfnOutput(this, 'ColaCapturasDlqUrl', { value: colaErrores.queueUrl });
    new CfnOutput(this, 'FuncionProceso', { value: proceso.functionName });
    new CfnOutput(this, 'GrupoLogsProceso', { value: '/toqui/prod/proceso' });
    // Lo exige `pnpm aws:prod:seed`: sin esta salida, la definición de tarea desplegada es
    // anterior a migrar-dataset-nucleos y no conoce `--cargar-dataset`.
    new CfnOutput(this, 'PrefijoDataset', { value: PREFIJO_DATASET });
  }
}
