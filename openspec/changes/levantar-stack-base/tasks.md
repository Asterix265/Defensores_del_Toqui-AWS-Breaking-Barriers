## 1. Raíz del monorepo

- [x] 1.1 Crear `package.json` raíz (`packageManager` pnpm exacto, `engines` Node 24, scripts), `pnpm-workspace.yaml`, `.node-version`, `.npmrc` (`engine-strict=true`), `.gitattributes` y `.editorconfig`
- [x] 1.2 Crear `tsconfig.base.json`, configuración de ESLint (flat config) y Prettier compartidos; completar `.gitignore` (`node_modules`, `dist`, `.env`, `cdk.out`)
- [x] 1.3 Crear `docker-compose.yml` con `postgres:17`, volumen y healthcheck, y `.env.example` sin valores reales

## 2. Paquete compartido

- [x] 2.1 Crear `packages/shared` con zod, el esquema `HealthResponse`, build y una prueba Vitest

## 3. API

- [x] 3.1 Crear `apps/api` con NestJS, módulo `health` y validación de configuración con zod
- [x] 3.2 Integrar Prisma con migración inicial mínima y verificar la base en `GET /health`
- [x] 3.3 Integrar `nestjs-zod` y Swagger en `/docs`; script que exporta `openapi.json`
- [x] 3.4 Crear prueba Jest del endpoint de salud y Dockerfile con Node 24; verificar `/health` desde el contenedor

## 4. Web

- [x] 4.1 Crear `apps/web` con Vite + React + TS, `vite-plugin-pwa`, TanStack Query y proxy `/api` → 3000
- [x] 4.2 Configurar orval (cliente, hooks y mocks MSW) y `pnpm contract`; página inicial que muestra la salud de la API
- [x] 4.3 Crear prueba Vitest de humo del componente inicial

## 5. Pipeline e infraestructura

- [x] 5.1 Crear `apps/pipeline` con un handler de ejemplo tipado, validado con zod, build con esbuild y prueba Vitest
- [x] 5.2 Crear `infra` con CDK v2 TS para `us-east-1`, stack de marcador y `pnpm infra:synth` funcionando sin credenciales

## 6. Calidad y documentación

- [x] 6.1 Scripts raíz `setup`, `dev`, `db:up`, `db:down`, `db:migrate`, `contract`, `lint`, `typecheck`, `test`, `build`, `infra:synth`, sin dependencia del shell
- [x] 6.2 Workflow de GitHub Actions con install congelado, lint, typecheck, test, build, `cdk synth` y verificación de contrato sin diferencias
- [x] 6.3 Ejecutar el flujo completo en limpio (setup → db:up → db:migrate → dev → contract → test → build → synth) y registrar el resultado
- [x] 6.4 Actualizar el README con requisitos (Node 24, Corepack, Docker) y los comandos verificados, y ajustar `definir-mvp-e1/tasks.md` para quitar lo ya cubierto
- [x] 6.5 Validar con `openspec validate levantar-stack-base --strict --no-interactive`
