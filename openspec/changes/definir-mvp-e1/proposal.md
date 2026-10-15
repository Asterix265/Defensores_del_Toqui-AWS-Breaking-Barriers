## Why

Las educadoras de Fundación Integra dedican, según la presentación del desafío E-1, unas 4 horas semanales a documentar y sistematizar observaciones; ese tiempo sale del aula. La hackatón (14–16 de octubre de 2026, cierre de desarrollo el 16 a las 10:15) exige acordar hoy un MVP demostrable, una arquitectura y un stack comunes para que un equipo de 6 personas trabaje en paralelo en un solo repositorio.

## What Changes

- Definir el MVP como un **copiloto de registro**: la educadora captura texto, audio o foto; la IA propone una observación con manifestaciones del catálogo y citas textuales que la respaldan; la educadora confirma o corrige; la trayectoria del niño o niña se actualiza.
- Fijar el stack: monorepo pnpm con Node 24 LTS; React + Vite (PWA); NestJS stateless con Prisma; PostgreSQL (Docker en local, Aurora Serverless v2 en AWS); Cognito; contrato de API en zod con OpenAPI y cliente generado; pipeline asíncrono S3 → Step Functions → Lambdas (Transcribe, Bedrock); infraestructura con AWS CDK en `us-east-1`.
- Establecer un proveedor de IA `fake` y un modo de autenticación `local` para desarrollar sin AWS.
- Registrar cada corrección (sugerencia de la IA frente a decisión final) y medir el acuerdo IA–educadora y el tiempo de registro.
- Cargar el dataset sintético público en PostgreSQL desde una ruta externa (`DATASET_DIR`), sin copiar los CSV al repositorio.
- Dejar como opcionales: video, ejemplos dinámicos con pgvector, prueba de carga y federación de identidad.
- Exclusiones: no se mapea la rúbrica institucional (10 núcleos × 8 niveles) con la ruta sintética (5 dominios × 9 niveles); no se emiten diagnósticos; no se usan datos ni medios reales de niños o niñas; no hay reentrenamiento de modelos.

## Capabilities

### New Capabilities

- `registro-observaciones`: captura multiformato (texto, audio, foto), revisión del borrador por la educadora y persistencia de la observación confirmada con su evidencia.
- `extraccion-evidencia-ia`: pipeline que convierte la captura en manifestaciones del catálogo con citas, nivel sugerido y manejo de evidencia insuficiente, con validación de la salida y protección de identificadores.
- `trayectoria-aprendizaje`: consulta de la trayectoria por niño o niña y dominio, resumen del grupo y detección de huecos de evidencia.
- `acceso-y-proteccion-datos`: autenticación, roles, aislamiento por jardín y resguardo de archivos y datos sintéticos.
- `medicion-impacto`: registro de tiempos de captura a confirmación y métrica de acuerdo entre IA y educadora.

### Modified Capabilities

- `entorno-desarrollo`: agrega el entorno local sin AWS (proveedor de IA `fake`, autenticación `local`) y la carga del dataset desde `DATASET_DIR`. La base técnica la define el cambio `levantar-stack-base`, que debe archivarse antes que este.

## Impact

- Código nuevo: `apps/web`, `apps/api`, `apps/pipeline`, `packages/shared`, `infra`, `scripts/seed`, `docker-compose.yml`, `.env.example`.
- Dependencias principales: NestJS, Prisma, zod, nestjs-zod, orval, React, Vite, AWS SDK v3, aws-jwt-verify, AWS CDK.
- Servicios AWS (cuenta del evento, `us-east-1`): S3, Step Functions, Lambda, Amazon Transcribe, Amazon Bedrock (Claude, Guardrails), ECS Fargate, ALB, Aurora Serverless v2, Secrets Manager, Cognito, S3 y CloudFront (web). Requieren permisos IAM, acceso a modelos de Bedrock y un plan de limpieza.
- Documentación: README (comandos verificados, ubicación del dataset) y `docs/` cuando cambien decisiones.
- Beneficio: se medirá con tiempos instrumentados y acuerdo IA–educadora sobre datos sintéticos; no se promete alcanzar la meta institucional de 0 horas.
