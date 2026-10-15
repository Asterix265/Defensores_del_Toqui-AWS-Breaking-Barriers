# Proposal

## Why

La educadora ya registra texto, audio y foto, y su decisión queda guardada (`persistir-capturas`). Pero la propuesta de nivel y manifestaciones sigue siendo **simulada**: el proveedor `fake` usa palabras clave, y la foto del post-it se reemplaza por un texto de ejemplo. El desafío E-1 pide que la IA proponga nivel y manifestaciones del catálogo con su evidencia, y la cuenta del evento ya tiene Claude y el Guardrail disponibles en `ToquiDev`.

Este cambio es el primer paso acordado en la comparación «¿IA en Nest o en Lambda?»: escribir la IA una sola vez, en un módulo aparte de Nest y de Lambda, y usarlo primero desde el modo `inline` de la API. Así la demo cuenta con un plan B real aunque el pipeline de Step Functions no esté listo.

## What Changes

- **Nuevo paquete `packages/ia`** (`@toqui/ia`), sin Nest, Prisma ni Lambda: interfaz `IaProvider` con `fake` (el mismo comportamiento de hoy) y `bedrock`, prompt, salida estructurada por herramienta de Converse y validación zod con un reintento.
- **`IA_PROVIDER=bedrock` en modo `inline`**:
  - Texto: el Guardrail anonimiza nombres, contactos y RUT, y luego Claude propone nivel y manifestaciones del catálogo de los niveles esperado ±1, cada una con una cita literal.
  - Foto: la API descarga la imagen de S3 y Claude la lee: transcribe lo escrito en el post-it o, si no hay texto, describe la actividad. Luego sigue el mismo camino que el texto.
  - Audio: sigue con el texto de ejemplo y la transcripción figura como **no implementada**. Transcribe es asíncrono y le corresponde a Step Functions.
- **`procesamiento` declara lo real**: la lectura de la foto y la extracción figuran como `completado` cuando las hizo Claude, y `simulado` pasa a `false` si ningún paso fue simulado.
- **Web**: la revisión rotula el texto como «Lo que se leyó en tu foto» cuando la lectura fue real, en vez de «Texto de ejemplo». Las fotos de más de 3,75 MB, el límite de Claude, se reducen en el navegador antes de subirlas.

**Hechos**: el modo `inline`, el campo `procesamiento`, la subida a S3 y `POST /capturas/:id/subida` existen en `main`. En `ToquiDev` están Claude Sonnet 5.5 (`us.anthropic.claude-sonnet-5-5`) y el Guardrail `toqui-dev-pii`, versión 2. Sonnet 5.5 rechaza forzar la herramienta en Converse, así que se usa `toolChoice: auto` con validación y reintento.

**Supuestos**: la foto principal es el post-it o la hoja donde la educadora anotó. Las citas se hacen sobre el texto anonimizado (`{NAME}`), que es el que se guarda.

**Decisiones pendientes**: el despliegue en producción. En `ToquiApp`, la API corre en modo `aws` y el pipeline todavía es el paso `eco`. Usar `inline` con `bedrock` en Fargate como plan B, o terminar el pipeline de Step Functions, se decide con el equipo junto con la propuesta `implementar-handler-transcripciones`.

**Exclusiones**: Transcribe, Lambdas y Step Functions, endpoint `GET /interno/capturas/:id/contexto`, cambios de infraestructura y despliegue, resúmenes con Haiku y `sharp` en el servidor.

## Capabilities

### New Capabilities

- `extraccion-ia`: propuesta de nivel y manifestaciones con Claude y Guardrail, y lectura de la foto, declaradas en el `procesamiento` del borrador.

### Modified Capabilities

(ninguna; `captura-y-persistencia` aún no está archivada. Su requisito «Aviso de procesamiento simulado» sigue valiendo para `IA_PROVIDER=fake` y para el audio.)

## Impact

- Código: `packages/ia` (nuevo), `apps/api/src/pipeline` (servicio inline y `procesamiento.ts`, que reemplaza `ia-fake.ts`), `AlmacenamientoService.descargar`, variables `IA_PROVIDER`, `BEDROCK_MODEL_EXTRACCION` y `BEDROCK_GUARDRAIL_*`, y `apps/web/src/registro` (rótulo del texto y tamaño de la foto).
- Build: `Dockerfile` de la API, scripts raíz y CI compilan `@toqui/ia`.
- AWS: invocaciones de Bedrock (Converse y ApplyGuardrail) con el perfil `toqui` en local; sin recursos nuevos.
- **Medición del beneficio**: con `bedrock`, una nota de texto o una foto de post-it llega a la revisión con una propuesta real y citas verificables, y el aviso deja de decir «simulado». Se puede contar cuántas propuestas confirma la educadora sin cambios y cuántas corrige.
