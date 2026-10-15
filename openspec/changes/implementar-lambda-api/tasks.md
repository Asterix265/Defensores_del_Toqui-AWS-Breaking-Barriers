## 1. Modelo y contrato

- [x] 1.1 Esquema Prisma (`usuarios`, `criterios`, `observaciones`, `revisiones`, `ejemplos`) y migración `20261015200000_api_observaciones` aplicada con `pnpm db:deploy`
- [x] 1.2 Esquemas zod en `packages/shared/src/observaciones.ts`; OpenAPI 3.1 y cliente orval regenerados con `pnpm contract`

## 2. API

- [x] 2.1 Configuración: `AUTH_MODO`, Cognito, S3, SQS, zona horaria y pesos, con validación para producción
- [x] 2.2 Guardia global de autenticación y rol, decoradores `@Publico`, `@Roles` e `@IdentidadActual`, y `GET /me`
- [x] 2.3 Servicios de S3 (POST firmado, lectura, `HeadObject`) y SQS
- [x] 2.4 Endpoints de criterios, subidas, observaciones, revisión, validación, archivo, mi día y panel
- [x] 2.5 Handler `src/lambda.ts` (serverless-express), probado con eventos simulados de HTTP API v2

## 3. Verificación y documentación

- [x] 3.1 Pruebas unitarias (configuración, fechas, token) y e2e contra PostgreSQL (34 en total); se comprobó que fallan al quitar el filtro de dueño
- [x] 3.2 Servicio Postgres en la CI; lint, formato, tipos, pruebas, build, contrato y síntesis en verde en local
- [x] 3.3 README, `.env.example` y `docs/modelo-datos.md` actualizados
- [x] 3.4 `openspec validate implementar-lambda-api --strict --no-interactive`
