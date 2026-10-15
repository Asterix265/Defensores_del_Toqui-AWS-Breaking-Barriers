## Why

La arquitectura v1 (documento de @Martin, 15-10-2026) separa la atención de la app del procesamiento con IA. Las educadoras necesitan registrar una observación y recibir respuesta en milisegundos. El trabajo lento (Transcribe, Textract, Bedrock, Polly) ocurre en segundo plano, en la Lambda de proceso. Sin la Lambda API no hay forma de crear observaciones, consultar la propuesta, confirmar o corregir, ni supervisar.

## What Changes

- Implementar en `apps/api` los endpoints de la Lambda API: `/me`, `/criterios`, `/subidas`, `/observaciones` (crear, consultar, revisión, validación, archivo), `/mi-dia` y `/panel` (observaciones y resumen).
- Autenticación con tokens de Cognito (grupos `registrador` y `supervisor`) verificada en un guardia global, y un modo `dev` solo para desarrollo.
- Modelo Prisma y migración: `usuarios`, `criterios`, `observaciones`, `revisiones` y `ejemplos`.
- Integración con S3 (POST firmado de 5 minutos, URLs de lectura) y SQS (encolar la observación).
- Handler `src/lambda.ts` con serverless-express para API Gateway HTTP API.
- Contrato zod en `packages/shared`, OpenAPI 3.1 y cliente orval regenerado.
- Pruebas e2e contra PostgreSQL y servicio Postgres en la CI.
- Exclusiones: Lambda de proceso, vector pgvector, lista de criterios, infraestructura CDK, adaptador de RDS Data API, vistas web y carga del dataset.

## Capabilities

### New Capabilities

- `api-observaciones`: registro, consulta, revisión, validación y supervisión de observaciones con control de rol y de dueño.

### Modified Capabilities

Ninguna.

## Impact

- Hechos: el procesamiento y los estados vienen del documento de arquitectura v1; el comportamiento de los endpoints, de la especificación entregada por el equipo.
- Supuestos: el supervisor ve las observaciones de todos (no hay jardines en el modelo v1). El día se calcula en `America/Santiago`. Los ejemplos del supervisor pesan 3 y los del registrador 1 (configurable).
- Decisiones pendientes: la lista fija de criterios; el adaptador de Prisma para la RDS Data API (las Lambdas van fuera de la VPC); el vector de pgvector, que agrega la Lambda de proceso.
- Beneficio medible: cada revisión guarda si coincide con la propuesta (`revisiones.coincide_con_propuesta`), lo que permite medir el acuerdo con la IA sin prometer la meta institucional.
- Dependencias nuevas en `apps/api`: AWS SDK v3 (S3, presigned post, presigner, SQS), `aws-jwt-verify`, `@codegenie/serverless-express`.
