## Why

Para desarrollar con IA real y login real, el equipo necesita servicios AWS de desarrollo compartidos y verificados en la cuenta del evento. El 15-10-2026 se confirmó que la SCP del evento permite Bedrock, Transcribe, S3, Cognito y CloudFormation en `us-east-1`, pero todavía no existe ningún recurso ni una forma reproducible de crearlos y probarlos.

## What Changes

- Agregar el stack CDK `ToquiDev` en `us-east-1`: bucket S3 de capturas de desarrollo, User Pool de Cognito con grupos, atributo de jardín y cliente web, y Bedrock Guardrail para datos personales.
- Agregar scripts para crear usuarios sintéticos de prueba, imprimir las variables de entorno a partir de las salidas del stack y ejecutar una prueba de humo de punta a punta (`pnpm aws:smoke`).
- Incluir un audio sintético corto, generado por síntesis de voz y sin personas reales, para probar Transcribe.
- Documentar en `docs/guia-aws.md` el acceso del equipo (`aws login`), el despliegue, la verificación, los costos y la limpieza.
- Reemplazar el stack de marcador `ToquiBase`.
- Exclusiones: no se crean recursos del ambiente demo (VPC, Aurora, Fargate, Step Functions, Amplify) ni se integra la API con estos servicios; eso pertenece a `definir-mvp-e1`.

## Capabilities

### New Capabilities

- `aws-desarrollo`: recursos AWS compartidos para desarrollo, creados con CDK, con usuarios de prueba, variables de entorno derivadas y prueba de humo de punta a punta.

### Modified Capabilities

Ninguna.

## Impact

- Código: `infra/lib/dev-stack.ts`, `infra/bin/app.ts`, `infra/scripts/*`, fixture de audio sintético, scripts raíz `aws:*`, `.env.example`, `docs/guia-aws.md` y README.
- Dependencias: AWS SDK v3 (STS, S3, Transcribe, Bedrock Runtime, Cognito, CloudFormation), `@aws-sdk/s3-request-presigner` y `aws-jwt-verify` en `infra`.
- AWS (cuenta del evento, `us-east-1`): `cdk bootstrap` una vez y el stack `ToquiDev`. Costo fijo cercano a cero; uso por demanda de Bedrock y Transcribe. Limpieza con `cdk destroy ToquiDev`.
