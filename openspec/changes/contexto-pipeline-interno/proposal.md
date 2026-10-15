# Proposal

## Why

Para que la IA devuelva tiempo a las educadoras del desafío E-1, el pipeline en AWS (Step Functions y la Lambda `procesar`) tiene que extraer manifestaciones de cada captura. Las Lambdas no tocan la base de datos (están fuera de la VPC y Aurora no es alcanzable), así que necesitan pedirle a la API lo mínimo para extraer: edad, nivel esperado y catálogo. Hoy la API solo recibe resultados (`POST /interno/capturas/:id/borrador` y `/error`) y el `PIPELINE_TOKEN` que los protege no existe en la infraestructura: el endpoint interno responde 503 en producción.

## What Changes

- **Nuevo `GET /interno/capturas/:id/contexto`**, autorizado con la cabecera `x-pipeline-token` igual que las rutas internas existentes (`operationId: obtenerContextoCaptura`). Devuelve `ContextoCaptura`: `id`, `formato` (`video` se informa como `audio`), `estado`, `texto` (solo si el formato es texto), `edadMeses` a la fecha de la captura, `nivelEsperado` y `catalogo` (manifestaciones de los niveles esperado ±1, ordenadas por `id`).
- **Sin datos identificables**: el contexto termina enviado a un modelo, así que no incluye `idNino`, nombres, apellidos, RUT, sala ni jardín.
- **Esquema `ContextoCapturaSchema`** en `packages/shared`.
- **Secreto `toqui-prod/pipeline-token`** en Secrets Manager (CDK), generado al desplegar, inyectado a la tarea Fargate de la API como `PIPELINE_TOKEN` y con su ARN expuesto como salida para que la Lambda tenga permiso de lectura.
- Contrato OpenAPI y cliente orval regenerados; `docs/arquitectura-aws.md` actualizado.

**Hechos**: `registrarBorrador` es idempotente por captura; el pipeline inline ya calcula edad y nivel con la misma regla (`edadEnMeses`, rango `[edadMinMeses, edadMaxMeses)`).

**Supuestos**: la Lambda llega a la API por CloudFront (`/api/*`) y la política de origen reenvía `x-pipeline-token`; se comprueba en la prueba de humo. El nivel esperado por edad es una referencia de la ruta sintética, no un diagnóstico.

**Decisiones pendientes**: rotación del token (fuera del alcance de la hackatón).

**Exclusiones**: la Lambda `procesar`, la máquina de estados y el permiso de lectura del secreto para la Lambda (Persona C); el módulo de IA `packages/ia` (Persona A); cambios al pipeline inline.

**Medición**: el beneficio se mide indirectamente, cuando el pipeline real entrega borradores sin intervención de la educadora; este cambio solo habilita ese flujo y no promete la meta institucional de horas.

## Capabilities

### New Capabilities

- `contexto-pipeline-interno`: contexto de una captura para el pipeline, sin datos identificables, y secreto compartido gestionado en la infraestructura.

### Modified Capabilities

Ninguna.

## Impact

- API: `CapturasService.contexto`, ruta en `interno.controller.ts`, pruebas e2e.
- Shared: `ContextoCapturaSchema`.
- Infra: secreto en `infra/lib/app-stack.ts`, salida `PipelineTokenSecretArn`, prueba de síntesis.
- Contrato: `apps/api/openapi.json` y `apps/web/src/api/generated`.
- La Persona C consume la respuesta tal cual; un cambio de campo se le avisa.
