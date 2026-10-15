## Context

Arquitectura v1: API Gateway (HTTP API) con autorizador de Cognito → Lambda API (NestJS + serverless-express) → Aurora Serverless v2, S3 y SQS → Lambda de proceso. La base de NestJS + Prisma (`levantar-stack-base`) ya existe. Datos sintéticos; sin despliegue en este cambio.

## Goals / Non-Goals

**Goals:** responder rápido, sin procesamiento pesado; reglas de rol y de dueño en el servidor; contrato tipado para la web; flujo completo probado en local.

**Non-Goals:** IA, infraestructura, vistas web, carga del dataset.

## Decisions

- **Rol desde el token.** Un guardia global verifica el JWT con `aws-jwt-verify` (JWKS en caché por contenedor), aunque API Gateway ya lo valide, para que la Lambda no dependa de cómo se invoca. El rol se toma de `cognito:groups`. Con ambos grupos gana `supervisor`, y sin ninguno la API responde 403. `@Roles()` restringe rutas; `/health` es `@Publico()`.
- **Dueño en la consulta.** Para un registrador, cada consulta lleva `usuarioId = sub`, y las observaciones ajenas o los IDs inválidos responden 404.
- **Cierre tras la validación.** La revisión usa un `updateMany` condicionado al estado, dentro de una transacción. Así una validación concurrente no se pisa, y la API responde 409 si la observación ya está validada.
- **`usuarios.id` = `sub` de Cognito.** Se crea o actualiza en la primera petición; una caché en memoria evita escribir en cada sondeo. Se aceptan tokens de id y de acceso (`tokenUse: null`). El de acceso no trae `name` ni `phone_number`, así que un dato ausente en el token nunca borra el guardado ni provoca una escritura.
- **Criterio vigente desnormalizado** (`criterio_id`): la propuesta, la última revisión o la validación. Simplifica los filtros y el resumen del panel.
- **Ejemplos:** uno por (observación, origen), con peso configurable. El vector irá en `observaciones` y lo escribirá la Lambda de proceso, así que la API no calcula embeddings. **La columna aún no existe**: la agrega el cambio de la Lambda de proceso (pgvector). Mientras tanto los ejemplos guardan criterio y peso, pero no sirven para buscar parecidos.
- **Subidas con POST firmado** (`createPresignedPost`): S3 exige la clave en `subidas/<sub>/`, el `Content-Type` y el `content-length-range`. Al crear la observación, la API comprueba con `HeadObject` que el archivo existe y es del tipo declarado, y que la clave no pertenezca ya a otra observación.
- **SQS:** si encolar falla, la observación pasa a `error` y la API responde 503.
- **Observaciones en `error` sin reencolar (intencional).** Los reintentos ocurren en SQS antes de llegar a `error`, y la cola de errores (DLQ) conserva el mensaje. Una vez en `error`, la salida es manual: el registrador o el supervisor eligen el criterio (pasa a `corregida` o `validada`). No hay endpoint para volver a encolar; si hiciera falta, se agrega uno que exija el estado `error`.
- **Fecha del día** en `America/Santiago`, guardada como `DATE`.
- **OpenAPI 3.1:** zod expresa los nulos como `type: [..., 'null']`. El texto anulable se publica como componente `TextoNulo`, porque Swagger interpreta ese arreglo en línea como `string[]`.
- **Modo `dev`** (`Bearer dev:<rol>:<id>`) para desarrollo y pruebas. La configuración lo rechaza en producción y exige `S3_BUCKET` y `SQS_QUEUE_URL`.

## Risks / Trade-offs

- [Prisma usa `@prisma/adapter-pg` (TCP), pero la arquitectura pide la RDS Data API desde Lambdas fuera de la VPC] → cambiar el adaptador en `PrismaService` antes de desplegar. Data API Client v2.4 anuncia un adaptador para Prisma 7, pendiente de evaluar.
- [Verificar el JWT dos veces] → coste de milisegundos con la JWKS en caché; a cambio, la Lambda es segura aunque se invoque sin API Gateway.
- [Supervisor sin alcance por jardín] → si se cargan jardines, agregar el filtro en `alcance()`.

## Trabajo fuera de este cambio

- Adaptador de Prisma para la RDS Data API y prueba contra Aurora.
- Infraestructura CDK: API Gateway HTTP API con autorizador de Cognito, Lambda API, bucket, cola con DLQ y permisos mínimos.
- Lista fija de criterios (seed).

## Infraestructura (para el cambio de CDK)

Región `us-east-1`. Rol IAM de la Lambda API con permisos mínimos: `s3:PutObject` sobre `subidas/*` (la firma del POST usa las credenciales de la Lambda), `s3:GetObject` sobre `subidas/*` y `polly/*` (cubre las URLs de lectura y `HeadObject`, que no tiene acción IAM propia), `sqs:SendMessage` sobre la cola, y `rds-data:ExecuteStatement`/`secretsmanager:GetSecretValue` si se usa la Data API. Bucket con CORS limitado al dominio de Amplify. Costos: Lambda y API Gateway por petición, casi nulos con datos de demo. Limpieza: `cdk destroy` y vaciar el bucket.
