# Design

## Context

ADR «¿IA en Nest o en Lambda?»: en producción la IA corre en una Lambda `procesar` orquestada por Step Functions. Solo la API habla con Aurora; las Lambdas le piden y le entregan datos por HTTP vía CloudFront (`{WebUrl}/api/interno/...`) con el secreto `PIPELINE_TOKEN`. Región `us-east-1`, stack `ToquiApp` (Fargate ARM64 detrás de ALB y CloudFront).

## Decisions

### 1. Un solo endpoint de contexto
La Lambda hace una llamada antes de extraer. Se reutilizan `autorizar` (comparación con `timingSafeEqual`, 503 sin `PIPELINE_TOKEN`) y `@ZodResponse`, igual que `borrador` y `error`.

### 2. Edad a la fecha de la captura
`edadEnMeses(fechaNacimiento, fecha de la captura)` de `apps/api/src/comun/fechas.ts`, con mínimo 0. Usar la fecha de hoy daría otro nivel si la captura se reprocesa días después.

### 3. Nivel esperado y catálogo ±1
Mismo criterio que el pipeline inline: el nivel cuyo rango `[edadMinMeses, edadMaxMeses)` contiene la edad, o el último si la supera. El catálogo incluye los niveles vecinos para que el modelo pueda sugerir un nivel adyacente; se ordena por `id` para que el prompt sea determinista. `catalogo` es asignable a `ContextoExtraccion` de `packages/ia` sin conversión.

### 4. Minimización de datos
La respuesta es una lista cerrada de campos (esquema Zod de salida); nada del niño o niña salvo la edad en meses. `estado` permite que la Lambda omita capturas que ya tienen borrador (idempotencia).

### 5. Secreto en Secrets Manager
`secretsmanager.Secret` `toqui-prod/pipeline-token`, 48 caracteres sin puntuación (evita problemas de escape en cabeceras), `RemovalPolicy.DESTROY` por ser entorno de hackatón. ECS lo inyecta como `PIPELINE_TOKEN`; el rol de ejecución recibe `GetSecretValue` automáticamente. El valor nunca va a Git.

**Permisos**: solo el rol de ejecución de la tarea de la API (y luego la Lambda, Persona C). **Costo**: ~0,40 USD/mes por secreto más llamadas. **Limpieza**: se elimina con `cdk destroy`.

## Risks

- Si CloudFront no reenvía `x-pipeline-token`, la Lambda recibe 401: se comprueba en la prueba de humo.
- Cambiar un nombre de campo rompe la Lambda de C: el contrato OpenAPI lo hace visible.
