## Context

Parte del código de `cola-ia-y-amplify` (sin desplegar): `ToquiRed` (VPC con subredes públicas y aisladas, sin NAT), `ToquiDatos` (Aurora Serverless v2 con el secreto `toqui-prod/aurora` del usuario `toqui_admin`) y `ToquiApp` (CloudFront → ALB público → Fargate en subred pública con IP pública, bucket de capturas, SQS, Lambda `proceso` fuera de la VPC). La web ya se publica en Amplify, que reenvía `/api/*` a CloudFront. Hallazgos y aprobación en `proposal.md`.

## Goals / Non-Goals

**Goals:**

- Que ningún token viaje en claro por internet y que el ALB solo sea alcanzable desde CloudFront.
- Que la API solo tenga los permisos que usa en AWS y en la base.
- Que los datos originales de una captura no vivan en la base más que en S3.
- Que todo se cree solo al desplegar: sin pasos manuales en la consola ni en la base.

**Non-Goals:**

- NAT Gateway, VPC endpoints de interfaz o mover la API a subredes privadas (costo).
- Rotación automática de secretos, KMS propio, WAF y Flow Logs.
- Un endpoint para que las personas borren capturas.

## Decisions

### D1. CloudFront VPC Origins y ALB interno

- `publicLoadBalancer: false`: el ALB queda en las subredes aisladas (las únicas privadas de la VPC). CloudFront lo alcanza con `VpcOrigin.withApplicationLoadBalancer` por HTTP dentro de la red de AWS.
- El SG del ALB mantiene la entrada desde la *prefix list* de CloudFront (opción 1 de la guía de VPC Origins, válida antes de crear el VPC Origin). Con el ALB sin IP pública, solo llegan las distribuciones que usan este VPC Origin, que es de la cuenta.
- El nombre del ALB cambia a `toqui-prod-api-int`: el esquema (`internet-facing` → `internal`) obliga a reemplazarlo, y CloudFormation no reemplaza un recurso con nombre fijo.
- *Alternativas:* certificado de ACM en el ALB (requiere dominio propio); API Gateway HTTP API con VPC Link (cambia la URL de la API en Amplify y la Lambda, y cobra por petición); cabecera secreta entre CloudFront y el ALB (no cifra el tramo).

### D2. CloudFront solo para la API

- El comportamiento por defecto y `/api/*` van al mismo VPC Origin, sin caché y con `ALL_VIEWER_EXCEPT_HOST_HEADER` (conserva `Authorization`). `/api/*` mantiene la función que quita el prefijo.
- Se eliminan el bucket `Web`, `BucketDeployment` y la función `RutasSpa`. El CORS del bucket de capturas solo acepta `ORIGEN_WEB_AMPLIFY`.
- La salida se sigue llamando `WebUrl` porque la leen `pnpm aws:prod:amplify` y la Lambda; su valor es la URL de CloudFront.

### D3. Permisos de la API en S3 y Bedrock

- `s3:PutObject` y `s3:GetObject` sobre `capturas/*` (firmar subidas y lecturas, `HeadObject`), y `s3:ListBucket` sobre el bucket, sin condición de prefijo: sin él, S3 responde 403 en vez de 404 a un `HeadObject` de un archivo que aún no existe, y `HeadBucket` (salud) falla.
- Sin `s3:DeleteObject*`, `PutObjectRetention`, `PutObjectLegalHold` ni acceso a `transcripciones/`.
- Sin `bedrock:*` ni variables `BEDROCK_*`: la API no invoca modelos. La memoria de `cola-ia-y-amplify` (tarea 8.2) agregará `bedrock:InvokeModel` solo sobre Titan cuando se implemente.

### D4. Salida de la API

- SG propio con `allowAllOutbound: false`, salida tcp/443 a `0.0.0.0/0` y tcp/5432 al SG de Aurora.
- Basta con 443: ECR, Secrets Manager, CloudWatch Logs, Cognito (JWKS), S3 y SQS usan HTTPS. El DNS de la VPC, el endpoint de metadatos de la tarea y Amazon Time Sync son direcciones locales que el SG no filtra.

### D5. Usuario de aplicación en Aurora

- `ToquiDatos` crea el secreto `toqui-prod/aurora-app` (`rds.DatabaseSecret` con usuario `toqui_app`, adjunto al cluster: incluye `host` y `port`).
- La tarea de la API tiene dos contenedores con la misma imagen:
  - `migraciones` (no esencial): recibe el secreto del administrador y la contraseña de `toqui_app`, ejecuta `node docker-entrypoint.mjs --migrar` y termina. Aplica `prisma migrate deploy` y luego, en una transacción con un *advisory lock*, crea `toqui_app` si no existe, le fija la contraseña del secreto y le da `SELECT`, `INSERT`, `UPDATE` y `DELETE` sobre las tablas y uso de las secuencias del esquema `public`, más privilegios por defecto para las tablas que creen migraciones futuras. Le quita todo sobre `_prisma_migrations`.
  - `web` (la API): arranca solo si `migraciones` terminó bien (`ContainerDependencyCondition.SUCCESS`), con `RUN_MIGRATIONS=false` y las credenciales de `toqui_app`.
- Las credenciales del administrador solo llegan al contenedor `migraciones`. El rol de la tarea (que usa el código de la API) no puede leer ningún secreto; los inyecta el rol de ejecución.
- Varias tareas que arrancan a la vez no chocan: Prisma usa su propio lock para migrar y la preparación del rol usa `pg_advisory_xact_lock`.
- La contraseña se envía por `stdin` a `prisma db execute` y no aparece en el log.
- *Alternativas:* tarea de ECS aparte lanzada por un recurso personalizado (no espera a que termine antes de que arranque la API); Lambda en la VPC (el motor de migraciones de Prisma no está en el paquete de la Lambda).

### D6. Retención de 7 días en la base

- `RetencionService` en la API vacía `texto` y `archivo_clave` de las capturas creadas hace más de 7 días (`DIAS_RETENCION_CAPTURAS`, igual que la regla de ciclo de vida de S3). Se ejecuta al arrancar y luego cada hora; es idempotente, así que varias tareas pueden hacerlo a la vez. No corre con `NODE_ENV=test`.
- Se conservan `borradores.texto_fuente` (anonimizado por el Guardrail), el formato, el tipo de archivo y la observación. `tieneArchivo` pasa a `false` y el resumen usa el texto anonimizado.
- S3 borra los objetos al cumplir 7 días (redondeado a la medianoche UTC siguiente): la base deja de apuntar al archivo antes o al mismo tiempo que S3 lo borra, nunca después.

### D7. Borrado de una captura

- `borradores`, `correcciones` y `eventos_tiempo` pasan a `ON DELETE CASCADE` sobre `capturas`. `observaciones.id_captura` ya era `ON DELETE SET NULL`: la observación confirmada se conserva en la trayectoria.

## Permisos, región, costos y limpieza

- **Región:** `us-east-1`.
- **Permisos:** D3 y D5. El rol de ejecución de la tarea lee los secretos `toqui-prod/aurora`, `toqui-prod/aurora-app` y `toqui/prod/pipeline-token`.
- **Costos:** VPC Origins no tiene cargo adicional. Un secreto más en Secrets Manager: USD 0,40 al mes. El contenedor de migraciones comparte CPU y memoria de la tarea. El ALB interno cuesta lo mismo que el público.
- **Limpieza:** `pnpm aws:prod:destroy` elimina el VPC Origin, el ALB y el secreto nuevo. Sin cambios para Amplify.

## Risks / Trade-offs

- [Reemplazo del ALB] → la API queda sin servicio mientras CloudFront cambia de origen (minutos). Desplegar con aviso y verificar con `pnpm aws:prod:smoke`.
- [El VPC Origin tarda hasta 15 minutos] → el despliegue de `ToquiApp` es más largo la primera vez.
- [Falla el contenedor de migraciones] → la API no arranca y el *circuit breaker* de ECS revierte el despliegue; el motivo queda en `/toqui/prod/api` con el prefijo `migraciones`.
- [Una migración futura crea tablas con otro rol] → los privilegios por defecto solo cubren las que crea `toqui_admin`; el contenedor vuelve a dar permisos sobre todas las tablas en cada arranque.
- [La educadora abre una captura con más de 7 días] → ve el texto anonimizado y no puede abrir el archivo original.
- [La API pierde un permiso que usaba sin saberlo] → las pruebas de CDK fijan los permisos y el smoke revisa salud (S3 y SQS), subida y procesamiento.
