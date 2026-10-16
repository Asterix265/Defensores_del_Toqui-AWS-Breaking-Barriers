## 1. Red y entrada

- [x] 1.1 ALB interno (`publicLoadBalancer: false`, nombre `toqui-prod-api-int`) y CloudFront con `VpcOrigin.withApplicationLoadBalancer` para el comportamiento por defecto y `/api/*` (D1, D2). Verificar con `prod-stacks.test.ts`: `Scheme: internal`, existe `AWS::CloudFront::VpcOrigin` y la distribución no tiene orígenes S3
- [x] 1.2 Eliminar el bucket `Web`, `BucketDeployment` y la función `RutasSpa`; CORS de capturas solo con Amplify; quitar el build de la web de `pnpm aws:prod:deploy` (D2, tarea 7.4 de `cola-ia-y-amplify`). Verificar con prueba de CDK
- [x] 1.3 SG de la API con salida solo a tcp/443 y tcp/5432 hacia Aurora (D4). Verificar con prueba de CDK

## 2. Permisos

- [x] 2.1 Rol de la API: `s3:PutObject` y `s3:GetObject` en `capturas/*`, `s3:ListBucket` en el bucket; quitar Bedrock y las variables `BEDROCK_*` (D3). Verificar con prueba de CDK que no hay `s3:DeleteObject*` ni `bedrock:*` en la política de la API

## 3. Usuario de aplicación en Aurora

- [x] 3.1 `ToquiDatos`: secreto `toqui-prod/aurora-app` (`toqui_app`) adjunto al cluster y expuesto a `ToquiApp` (D5)
- [x] 3.2 `docker-entrypoint.mjs --migrar`: migraciones y preparación idempotente de `toqui_app` con *advisory lock*, contraseña por `stdin` (D5)
- [x] 3.3 Tarea de ECS: contenedor `migraciones` no esencial con el secreto del administrador; la API depende de él (`SUCCESS`), con `RUN_MIGRATIONS=false` y las credenciales de `toqui_app`. Verificar con prueba de CDK que solo `migraciones` recibe el secreto del administrador
- [x] 3.4 Verificar contra PostgreSQL local que el SQL de preparación es idempotente y que `toqui_app` no puede `DROP TABLE` ni modificar `_prisma_migrations`
  - Verificado el 15-10-2026 con PostgreSQL 17: dos corridas de `--migrar` sin error; la segunda cambia la contraseña y la anterior queda rechazada. `toqui_app` lee, inserta y borra; `DROP`, `CREATE` y `ALTER TABLE` y `_prisma_migrations` responden «permission denied» o «must be owner».

## 4. Retención y borrado

- [x] 4.1 Migración Prisma: `ON DELETE CASCADE` en `borradores`, `correcciones` y `eventos_tiempo` hacia `capturas` (D7). Verificar con `pnpm db:deploy` en local
- [x] 4.2 `RetencionService` en la API (D6). Verificar con prueba e2e: captura de 8 días queda sin `texto` ni archivo y conserva `textoFuente`; captura de 2 días no cambia; borrar una captura confirmada conserva la observación

## 5. Verificación, despliegue y documentación

- [x] 5.1 `lint`, `typecheck` y `test` de `infra` y `apps/api`; `cdk synth` sin errores
- [x] 5.2 Ajustar `pnpm aws:prod:smoke`: web en Amplify, API por CloudFront y ALB sin acceso directo
- [ ] 5.3 Desplegar con aviso al equipo (`pnpm aws:prod:deploy`) y verificar con `pnpm aws:prod:smoke`
- [x] 5.4 Actualizar `docs/arquitectura-aws.md` (diagrama, servicios, permisos) y el README
- [x] 5.5 Validar con `openspec validate endurecer-seguridad-aws --strict --no-interactive`
