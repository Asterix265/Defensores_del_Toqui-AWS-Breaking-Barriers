## Context

El stack se acordó en conversación y está detallado como decisión en `openspec/changes/definir-mvp-e1/design.md`: Node 24, pnpm, React + Vite, NestJS + Prisma + PostgreSQL, zod + OpenAPI + orval, Lambdas TypeScript y CDK. Este cambio solo prepara esa base técnica para que 6 personas en Windows, macOS y Linux puedan empezar a trabajar en paralelo. El repositorio no tiene código todavía.

## Goals / Non-Goals

**Goals:**
- Clonar, preparar y levantar en pocos minutos en cualquier sistema operativo.
- Probar de punta a punta que el stack funciona: web → API → Postgres, contrato generado, handler del pipeline y síntesis de CDK.
- Fijar convenciones (estructura, lint, formato, pruebas, CI) antes de que el equipo escriba funcionalidades.

**Non-Goals:**
- Modelo de dominio, carga del dataset, autenticación, IA, almacenamiento de archivos, Step Functions y despliegue en AWS.
- Diseño visual de la aplicación.

## Decisions

### Estructura
```
apps/web          React + Vite + TS, vite-plugin-pwa, TanStack Query
apps/api          NestJS + Prisma + nestjs-zod + @nestjs/swagger
apps/pipeline     handlers Lambda en TS (esbuild), sin infraestructura aún
packages/shared   esquemas zod y tipos
infra             AWS CDK v2 en TS, stack vacío o de marcador
```
Paquetes con nombre `@toqui/<paquete>` y dependencias internas mediante `workspace:*`.

### Versiones y multiplataforma
`.node-version` con 24, `packageManager` con una versión exacta de pnpm activada por Corepack, `engines` en el `package.json` raíz, `.gitattributes` con `* text=auto eol=lf` y `.editorconfig`. Los scripts que necesiten lógica usan Node (`.mjs`) o herramientas multiplataforma (`concurrently`), nunca `rm -rf` ni `&&` dependientes del shell.
- *Alternativa:* Makefile o just (Make no está disponible por defecto en Windows).

### Orquestación de tareas
Scripts pnpm recursivos (`pnpm -r --parallel`, filtros `--filter`). No se usa Turborepo ni Nx: con 5 paquetes no compensa su configuración.

### Pruebas
Vitest en `web`, `shared` y `pipeline`; Jest en `api` porque es el estándar de `@nestjs/testing` y evita configurar SWC. Solo pruebas de humo en este cambio.
- *Alternativa:* Vitest en todo el repo (requiere configuración extra de decoradores en Nest).

### Contrato
`packages/shared` exporta el esquema `HealthResponse`. La API lo usa vía `createZodDto`. Un script exporta `openapi.json` sin levantar el servidor HTTP y orval genera `apps/web/src/api/` (cliente, hooks y mocks MSW). El código generado se versiona para que el frontend funcione sin la API levantada.

### Base de datos
`docker-compose.yml` con `postgres:17`, volumen nombrado y healthcheck. Prisma con una migración inicial mínima (tabla técnica `_salud` o migración vacía) para validar la cadena; el modelo de dominio llega con el cambio funcional.

### Puertos
Web 5173, API 3000, Postgres 5432 (valores por defecto de cada herramienta). Vite redirige `/api` a la API para evitar CORS en local.

### CI
GitHub Actions en `ubuntu-latest` con Node 24 y pnpm: `install --frozen-lockfile`, lint, typecheck, test y build, más `cdk synth`. Sin despliegue.

### Configuración
`.env.example` en la raíz con `DATABASE_URL`, `PORT`, `NODE_ENV` y `AWS_REGION=us-east-1`. Cada app valida su subconjunto con zod. `.env` ya está en `.gitignore`; hay que verificarlo y completarlo si falta.

## Risks / Trade-offs

- [Docker Desktop en Windows sin WSL2 o lento] → documentar el requisito; Postgres es el único servicio en Docker.
- [Prisma descarga binarios por plataforma] → `binaryTargets` incluye `native` y el destino de la imagen Linux; si surgen problemas, se prueba en CI.
- [Diferencias de versión de Node entre personas] → `engines` con `engine-strict` y `.node-version`.
- [El lockfile cambia según la versión de pnpm] → pnpm fijado por Corepack y `--frozen-lockfile` en CI.
- [Código generado por orval desactualizado] → CI verifica que `pnpm contract` no deje diferencias.

## Migration Plan

No aplica: es la base inicial. Si algo falla, se revierte el commit.

## Open Questions

- ¿Existe ya el repositorio remoto en GitHub con las 6 personas como colaboradoras, para habilitar la CI y la protección de `main`?
