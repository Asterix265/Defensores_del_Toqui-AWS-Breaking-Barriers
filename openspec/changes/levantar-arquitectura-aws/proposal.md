## Why

El equipo quiere la arquitectura completa del ambiente de producción (demo) creada y conectada en AWS antes de construir el MVP, para descubrir problemas de despliegue temprano y no el viernes antes del cierre. Hoy solo existe el stack de desarrollo `ToquiDev`.

## What Changes

- Agregar tres stacks CDK en `us-east-1`:
  - `ToquiRed`: VPC con subredes públicas y aisladas, sin NAT.
  - `ToquiDatos`: Aurora Serverless v2 (PostgreSQL 17) en subredes aisladas, con credenciales en Secrets Manager.
  - `ToquiApp`: S3 de capturas, Cognito, Guardrail, API NestJS en ECS Fargate detrás de un ALB, pipeline S3 → EventBridge → Step Functions → Lambda, y web en S3 + CloudFront con `/api/*` hacia el ALB.
- La imagen de la API aplica las migraciones de Prisma al arrancar y arma `DATABASE_URL` desde el secreto de Aurora.
- Agregar scripts `pnpm aws:prod:*` (desplegar, prueba de humo, destruir) y documentación de la arquitectura.
- **Cambio de decisión:** la web se sirve con S3 + CloudFront en lugar de Amplify Hosting, para tener un solo dominio HTTPS para la web y la API y todo en CDK.
- Exclusiones: funcionalidades del MVP, dominio propio, alerta de presupuesto (pendiente del equipo) y alta disponibilidad multirregión.

## Capabilities

### New Capabilities

- `aws-produccion`: infraestructura del ambiente demo, creada con CDK, con la web, la API, la base de datos y el pipeline conectados y verificables.

### Modified Capabilities

Ninguna.

## Impact

- Código: `infra/lib/{red,datos,app}-stack.ts`, `infra/bin/app.ts`, scripts de despliegue y prueba, Dockerfile y entrypoint de la API, `docs/arquitectura-aws.md`, guía y README.
- Dependencias: `prisma` y `dotenv` pasan a dependencias de ejecución de la API (migraciones en el contenedor).
- AWS: VPC, Aurora Serverless v2, Secrets Manager, ECR (activo de CDK), ECS Fargate, ALB, CloudFront, S3, Cognito, Bedrock Guardrail, EventBridge, Step Functions, Lambda y CloudWatch Logs. Costo de varios dólares al día mientras exista; se elimina con `pnpm aws:prod:destroy`.
