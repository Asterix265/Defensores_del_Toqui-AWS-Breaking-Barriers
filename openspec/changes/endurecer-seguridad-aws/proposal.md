## Why

Las educadoras de Integra registran notas sobre niños y niñas: aunque la demo usa datos sintéticos, la arquitectura debe tratar esas notas como datos personales de menores. Una revisión del 15-10-2026 de `ToquiRed`, `ToquiDatos` y `ToquiApp` (código de `cola-ia-y-amplify`, sintetizado con CDK) encontró:

- el tramo CloudFront → ALB va por HTTP a través de internet, con los JWT de Cognito y el `PIPELINE_TOKEN` en claro, y el ALB es público (cualquier distribución de CloudFront llega a él);
- la API tiene `s3:DeleteObject*` y escritura sobre todo el bucket de capturas, y permisos de Bedrock que no usa;
- la API sale a internet por cualquier puerto y protocolo;
- la API se conecta a Aurora con el usuario administrador, que puede cambiar o borrar tablas;
- el texto original de la nota (sin anonimizar) queda para siempre en Aurora, mientras el audio y la foto se borran a los 7 días;
- no se puede borrar una captura sin borrar a mano sus filas dependientes;
- la web sigue publicada también en S3 + CloudFront, aunque ya está en Amplify.

El equipo (Martín) aprobó el 15-10-2026 las propuestas 1 a 8 de esa revisión.

## What Changes

- **ALB interno con CloudFront VPC Origins:** el ALB deja de ser público y CloudFront lo alcanza por la red de AWS. La URL de CloudFront no cambia.
- **Sin web en CloudFront** (tarea 7.4 de `cola-ia-y-amplify`): se eliminan el bucket web, `BucketDeployment` y la función de rutas SPA; CloudFront queda solo para la API y el CORS de capturas solo acepta Amplify.
- **IAM de la API:** solo `s3:PutObject` y `s3:GetObject` en `capturas/*` y `s3:ListBucket` en el bucket; sin permisos ni variables de Bedrock.
- **Salida de la API:** solo HTTPS (443) hacia internet y PostgreSQL (5432) hacia Aurora.
- **Usuario de aplicación en Aurora:** `toqui_app`, sin permisos de DDL, con su propio secreto. Un contenedor de inicialización con las credenciales del administrador aplica las migraciones y crea o actualiza `toqui_app` antes de que arranque la API.
- **Retención de 7 días en la base:** la API vacía `capturas.texto` y `capturas.archivo_clave` de las capturas con más de 7 días, igual que el ciclo de vida de S3.
- **Borrado de una captura completa:** borrador, corrección y eventos de tiempo se borran en cascada; la observación confirmada se conserva sin vínculo (ya era `SET NULL`).
- **BREAKING (infraestructura):** el ALB se reemplaza (nombre nuevo `toqui-prod-api-int`), la web deja de servirse por CloudFront y `pnpm aws:prod:deploy` ya no compila la web.

## Capabilities

### New Capabilities

- `seguridad-infraestructura`: entrada única por CloudFront con ALB interno, permisos mínimos de la API en S3, salida acotada y usuario de base sin DDL.
- `retencion-capturas`: retención de 7 días de los datos originales de la captura y borrado completo de una captura.

### Modified Capabilities

Ninguna: `openspec/specs/` está vacío. `publicacion-web` (en `cola-ia-y-amplify`) no cambia de requisitos: este cambio completa su tarea 7.4.

## Impact

- **Hechos:** Amplify sirve la web en `https://main.dgsos3g6dvh6h.amplifyapp.com` y reenvía `/api/*` a la URL de CloudFront (`WebUrl`); la Lambda de proceso usa esa misma URL. Ninguna de las dos cambia.
- **Supuestos:** la cuenta del evento permite VPC Origins en `us-east-1`; el motor de Aurora 17 acepta `ALTER DEFAULT PRIVILEGES` del administrador.
- **Exclusiones:** endpoint de borrado de capturas para usuarios; restringir el SG por defecto de la VPC, la salida del SG de Aurora, los ARN de Bedrock y Transcribe, Flow Logs, KMS y WAF (propuestas 9 a 13, no aprobadas).
- **Código:** `infra/lib/{app-stack,datos-stack}.ts`, `infra/bin/app.ts`, pruebas de infra, `infra/scripts/smoke-prod.ts`, `apps/api/docker-entrypoint.mjs`, `apps/api/src/capturas/` (retención), esquema y migración Prisma, `package.json` raíz y documentación.
- **Despliegue:** reemplazar el ALB deja la API sin servicio unos minutos y el VPC Origin tarda hasta 15 minutos en crearse. Avisar al equipo antes de desplegar.
