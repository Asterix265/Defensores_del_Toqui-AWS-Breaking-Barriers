## Context

Cuenta del evento con SCP; `us-east-1` permite todos los servicios necesarios. Ya existen el bootstrap de CDK y el stack `ToquiDev`. La API solo tiene `/health` y el pipeline solo un handler de ejemplo: este cambio monta la infraestructura y la verifica con eso.

## Goals / Non-Goals

**Goals:** arquitectura completa del diseño de `definir-mvp-e1`, desplegada y verificada de punta a punta; documentación para el equipo.

**Non-Goals:** lógica del MVP, dominio propio con certificado, alerta de presupuesto, multirregión y CI/CD de despliegue.

## Decisions

- **Tres stacks** (`ToquiRed` → `ToquiDatos` → `ToquiApp`): la red y la base cambian poco; la app se redepliega seguido sin tocar Aurora.
- **VPC sin NAT:** Fargate en subredes públicas con IP pública (llega a ECR, Secrets Manager, Bedrock y S3 sin NAT); Aurora en subredes aisladas. Ahorra el NAT y simplifica.
- **Aurora Serverless v2, PostgreSQL 17.9**, 0,5–4 ACU, un escritor, credenciales generadas en Secrets Manager (sin caracteres especiales problemáticos en la URL).
- **API en Fargate ARM64** (igual que el Mac de desarrollo, sin emulación), 0,5 vCPU / 1 GB, autoescalado de 1 a 4 tareas por CPU al 60 %. La imagen se construye desde `apps/api/Dockerfile` como activo de CDK.
- **Entrypoint `docker-entrypoint.mjs`:** arma `DATABASE_URL` desde `DB_*` (inyectados desde el secreto), ejecuta `prisma migrate deploy` y arranca la API. Prisma usa un *advisory lock*, así que varias tareas no chocan.
- **CloudFront delante de todo:** comportamiento por defecto hacia el bucket web (OAC) con una CloudFront Function para el enrutamiento de SPA; `/api/*` hacia el ALB por HTTP, sin caché, con una función que quita el prefijo `/api`. No se usan respuestas de error globales, que afectarían también a la API.
- **ALB restringido a CloudFront** con la *prefix list* administrada `com.amazonaws.global.cloudfront.origin-facing`.
- **Web publicada con `BucketDeployment`** desde `apps/web/dist` (el script compila antes de desplegar) e invalidación de CloudFront.
- **Pipeline:** el bucket emite eventos a EventBridge; una regla para `Object Created` con prefijo `capturas/` inicia la máquina `toqui-captura`, que invoca la Lambda (Node 24, ARM64) desde `apps/pipeline/dist`. Las Lambdas quedan fuera de la VPC y ya tienen permisos para Bedrock, Transcribe y S3.
- **Cognito y Guardrail de producción** separados de los de desarrollo; el cliente de producción usa solo SRP.
- **Web en S3 + CloudFront en vez de Amplify:** un solo dominio HTTPS para la web y la API y todo en CDK.

## Risks / Trade-offs

- [Aurora tarda unos 10 minutos en crearse] → se despliega una sola vez; los cambios de la app van en `ToquiApp`.
- [La imagen Docker es grande por incluir la CLI de Prisma] → aceptable para la demo; optimizar después.
- [El ALB usa HTTP entre CloudFront y el origen] → el tráfico solo entra desde CloudFront; usar HTTPS de origen exige un dominio con certificado.
- [Costo continuo de Aurora, ALB y Fargate] → destruir al terminar la hackatón; alerta de presupuesto pendiente.

## Migration Plan

`pnpm aws:prod:deploy` (compila la web y el pipeline y despliega los tres stacks) → `pnpm aws:prod:smoke`. Para revertir: volver a desplegar la versión anterior; para borrar: `pnpm aws:prod:destroy`.
