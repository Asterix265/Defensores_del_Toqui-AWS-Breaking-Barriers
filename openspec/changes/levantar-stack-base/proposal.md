## Why

El equipo (6 personas en Windows, macOS y Linux) necesita un repositorio con el stack acordado ya funcionando antes de construir funcionalidades. Sin una base común, cada persona configuraría herramientas por su cuenta y perderíamos horas de una hackatón que cierra el desarrollo el 16 de octubre de 2026 a las 10:15.

## What Changes

- Crear el monorepo pnpm con Node 24 LTS, TypeScript, ESLint, Prettier y scripts multiplataforma.
- Crear los esqueletos ejecutables de `apps/web` (React + Vite, PWA), `apps/api` (NestJS + Prisma), `apps/pipeline` (Lambdas TypeScript), `packages/shared` (zod) e `infra` (AWS CDK).
- Levantar PostgreSQL local con Docker Compose y conectar la API mediante Prisma.
- Dejar funcionando la cadena de contrato zod → OpenAPI → cliente orval con un único endpoint técnico de salud.
- Validar la configuración con zod y entregar `.env.example`.
- Configurar pruebas básicas e integración continua (lint, tipos, pruebas, build).
- Documentar en el README los comandos verificados.
- Exclusiones: sin modelo de dominio, carga del dataset, autenticación, IA, pipeline funcional ni despliegue en AWS. Esas partes pertenecen a `definir-mvp-e1` y a cambios posteriores.

## Capabilities

### New Capabilities

- `entorno-desarrollo`: monorepo multiplataforma, servicios locales, esqueletos ejecutables, contrato de API compartido, configuración validada, calidad automatizada e infraestructura sintetizable.

### Modified Capabilities

Ninguna; no existen especificaciones previas en `openspec/specs/`.

## Impact

- Archivos nuevos en la raíz (`package.json`, `pnpm-workspace.yaml`, `.node-version`, `.gitattributes`, `.editorconfig`, configuración de TypeScript, ESLint y Prettier, `docker-compose.yml`, `.env.example`) y en `apps/`, `packages/`, `infra/` y `.github/workflows/`.
- Dependencias: NestJS, Prisma, zod, nestjs-zod, @nestjs/swagger, React, Vite, vite-plugin-pwa, orval, TanStack Query, AWS CDK, Vitest/Jest.
- No crea recursos en AWS: `infra` solo debe sintetizar (`cdk synth`).
- `definir-mvp-e1` deberá ajustarse para no repetir las tareas de base cubiertas aquí.
