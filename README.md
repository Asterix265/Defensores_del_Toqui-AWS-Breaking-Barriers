# Defensores del Toqui — AWS Breaking Barriers

Proyecto de la hackatón **AWS Breaking Barriers Chile 2026**, enfocado en Fundación Integra y el desafío **E-1: Ruta de Trayectoria de Aprendizaje**.

La presentación sitúa el evento entre el 14 y el 16 de octubre de 2026, en la Universidad de Chile, Beauchef 851, Santiago.

## Propósito

Devolver tiempo de aula a las educadoras reduciendo el trabajo de documentación y sistematización de observaciones, sin perder la trazabilidad del aprendizaje de cada niño o niña. La presentación denomina esta línea «IA para el Desarrollo Infantil: de la Observación a la Acción».

La línea base declarada en la presentación es de **4 horas semanales** de documentación por educadora; su meta aspiracional es llegar a **0 horas**. Estos valores describen el desafío, no resultados alcanzados por este proyecto.

## Estado actual

La base técnica del monorepo está lista (cambio OpenSpec `levantar-stack-base`): web, API, pipeline, paquete compartido e infraestructura compilan, tienen pruebas de humo y se comunican en local. **Todavía no hay funcionalidades del desafío**: modelo de dominio, carga del dataset, autenticación, IA y despliegue en AWS pertenecen al cambio `definir-mvp-e1`, que está propuesto y pendiente de implementación. Los servicios AWS de desarrollo (stack `ToquiDev`) y la arquitectura de producción (`ToquiRed`, `ToquiDatos`, `ToquiApp`) están desplegados; la API y el pipeline de producción todavía solo tienen los endpoints y pasos técnicos de ejemplo.

## Stack

| Parte | Tecnología | Ubicación |
| --- | --- | --- |
| Web (PWA) | React 19 + Vite + TypeScript, TanStack Query, vite-plugin-pwa | `apps/web` |
| API | NestJS 11 + Prisma 7 (PostgreSQL), nestjs-zod, Swagger | `apps/api` |
| Pipeline | Handlers Lambda en TypeScript (esbuild, `nodejs24.x`) | `apps/pipeline` |
| Contrato | Esquemas zod → OpenAPI → cliente orval (hooks y mocks MSW) | `packages/shared` |
| Infraestructura | AWS CDK v2 en TypeScript, `us-east-1` (stacks de desarrollo y producción) | `infra` |
| Base local | PostgreSQL 17 en Docker | `docker-compose.yml` |

## Desarrollo local

Requisitos: **Node 24 LTS** (`.node-version`), **pnpm 11** (fijado en `packageManager`; se activa con `corepack enable`) y **Docker** (en Windows, Docker Desktop con WSL2). Los comandos funcionan igual en Windows, macOS y Linux.

Primera vez, desde la raíz del repositorio:

```sh
corepack enable
cp .env.example apps/api/.env      # en PowerShell: Copy-Item .env.example apps/api/.env
pnpm setup                          # instala dependencias, compila shared y genera Prisma
pnpm db:up                          # Postgres en localhost:5432
pnpm db:deploy                      # aplica las migraciones versionadas
pnpm dev                            # web en http://localhost:5173 y API en http://localhost:3000
```

La web muestra el estado de la API; Swagger está en http://localhost:3000/docs. Se usan los puertos por defecto (web 5173, API 3000, Postgres 5432): si otro servicio local ya los ocupa, hay que detenerlo antes de levantar el proyecto.

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Web y API en modo desarrollo |
| `pnpm db:up` / `pnpm db:down` | Inicia o detiene Postgres local |
| `pnpm db:deploy` | Aplica las migraciones existentes sin crear nuevas (primera vez y tras cada `git pull`) |
| `pnpm db:migrate` | Solo al modificar `schema.prisma`: crea una migración nueva y la aplica (`prisma migrate dev`) |
| `pnpm contract` | Exporta `apps/api/openapi.json` y regenera el cliente web en `apps/web/src/api/generated` |
| `pnpm lint` / `pnpm format` | ESLint y Prettier |
| `pnpm typecheck` / `pnpm test` / `pnpm build` | Tipos, pruebas y build de todos los paquetes |
| `pnpm infra:synth` | Sintetiza CloudFormation sin desplegar ni requerir credenciales |
| `pnpm aws:*` | Despliegue y prueba de los servicios AWS de desarrollo (ver [guía AWS](docs/guia-aws.md)) |
| `pnpm aws:prod:*` | Despliegue, prueba y borrado del ambiente de producción (ver [arquitectura AWS](docs/arquitectura-aws.md)) |

Imagen de la API (desde la raíz): `docker build -f apps/api/Dockerfile -t toqui-api .`

Al cambiar un esquema de `packages/shared` o un endpoint, ejecutar `pnpm contract` y versionar el resultado: la CI falla si el contrato generado queda desactualizado. La CI (`.github/workflows/ci.yml`) ejecuta lint, formato, tipos, pruebas, build, contrato y síntesis en cada pull request.

Verificado el 14-10-2026 en macOS con Node 24.22.0 y pnpm 11.13.0, en una copia limpia del repositorio. Falta confirmar en Windows y Linux, y la primera ejecución de la CI en GitHub.

## AWS de desarrollo

Bedrock (Claude y Guardrail), Transcribe, S3 y Cognito están desplegados para desarrollo en la cuenta del evento (`us-east-1`, stack CDK `ToquiDev`). Configuración, comandos (`pnpm aws:smoke`, `pnpm aws:env`, `pnpm aws:deploy`), usuarios de prueba, costos y limpieza: [guía AWS](docs/guia-aws.md).

El ambiente de producción (CloudFront, Fargate, Aurora Serverless v2, pipeline con Step Functions) se despliega con `pnpm aws:prod:deploy`; diagrama, stacks y decisiones en [arquitectura AWS](docs/arquitectura-aws.md).

## Materiales del desafío

Los originales se mantienen en la carpeta hermana `../Desafio/`; no se copian al repositorio.

| Recurso | Ubicación relativa a este repositorio |
| --- | --- |
| Presentación de Integra | `../Desafio/bb-assets-e1-presentation.pptx` |
| Dataset público y documentación | `../Desafio/dataset_e1_publico/` |
| Diccionario | `../Desafio/dataset_e1_publico/diccionario_datos.md` |
| Distribución y validación publicada | `../Desafio/dataset_e1_publico/distribucion_y_validacion.md` |
| Ejemplos de trayectorias | `../Desafio/dataset_e1_publico/ejemplos_trayectorias.md` |

Portal proporcionado: [Fundación Integra — desafíos](https://d78v2swml9yu2.cloudfront.net/?inst=integra).

Quien clone solo este repositorio deberá obtener los materiales públicos y ubicarlos en una carpeta hermana `Desafio`, o documentar su ubicación alternativa. El [contexto del desafío](docs/contexto-desafio.md) resume las fuentes y sus diferencias; el [contexto de la hackatón](docs/contexto-hackaton.md) reúne cronograma, criterios de evaluación, enunciado E-1 y resumen del dataset.

## Dataset disponible

Datos sintéticos de uso pedagógico, con fecha de referencia **2026-10-13**. Se verificaron los conteos leyendo los siete CSV locales:

| Entidad | Registros |
| --- | ---: |
| Jardines | 20 |
| Personal observador | 80 |
| Niños y niñas | 500 |
| Niveles de la ruta sintética | 9 |
| Manifestaciones | 90 |
| Observaciones | 2.950 |
| Vínculos observación–manifestación | 8.850 |

`datos_publicos/consolidado.json` ofrece una vista anidada de los datos. Los formatos `texto`, `audio`, `foto` y `video` son metadatos: **no se entregan archivos multimedia**. La ausencia de un registro no implica ausencia de aprendizaje. La ruta sintética no es un instrumento clínico ni una evaluación validada.

## Trabajo con OpenSpec

Requisito: CLI `@fission-ai/openspec` (versión usada en esta inicialización: `1.4.1`). Si no está instalado:

```sh
npm install -g @fission-ai/openspec@1.4.1
```

Desde la raíz del repositorio:

```sh
openspec list
openspec list --specs
openspec validate <cambio> --strict --no-interactive
```

Sin instalación global también funciona `npx @fission-ai/openspec@1.4.1 <comando>`. Cambios activos: `levantar-stack-base` (base técnica, implementada) y `definir-mvp-e1` (MVP del desafío, pendiente).

La configuración y el contexto están en `openspec/config.yaml`. Las especificaciones consolidadas se guardan en `openspec/specs/`, los cambios en `openspec/changes/` y su historial en `openspec/changes/archive/`.

Claude dispone de comandos `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:sync` y `/opsx:archive`. Codex dispone de las habilidades locales equivalentes en `.codex/skills/`; por ejemplo, `openspec-propose`. La instalación de comandos globales de Codex quedó impedida por permisos fuera del repositorio; las habilidades locales sí están presentes.

## Skills para agentes

Además de las skills de OpenSpec, `.claude/skills/` y `.codex/skills/` incluyen tres skills oficiales de Prisma, del repositorio [`prisma/skills`](https://github.com/prisma/skills), generadas con `prisma init` de Prisma 7.10 el 14-10-2026:

- `prisma-cli`: comandos de Prisma 7 (`generate`, `migrate`, `db`, `studio`) y sus resguardos ante acciones destructivas.
- `prisma-client-api`: consultas, filtros, relaciones y transacciones con Prisma Client.
- `prisma-upgrade-v7`: cambios de Prisma 7 (generador `prisma-client`, `prisma.config.ts`, driver adapters, ESM/CJS).

Se excluyeron las skills de otras bases de datos, de los servicios en la nube de Prisma y `prisma-orm-setup`, porque orienta a Prisma 8 y el proyecto usa Prisma 7. Si se actualiza Prisma, regenerarlas con `prisma init` en una carpeta temporal y copiar solo estas tres.

## Próximos pasos

1. Implementar `definir-mvp-e1`: modelo de dominio, carga del dataset, flujo de captura y confirmación, y trayectoria.
2. Resolver cómo representar la rúbrica institucional frente a la ruta sintética del dataset.
3. Configurar IAM, acceso a modelos de Bedrock y despliegue en AWS, documentando permisos, costos y limpieza.
4. Medir tiempo de documentación y trazabilidad con datos sintéticos; reportar resultados reales de la demo.

Las reglas de colaboración están en [AGENTS.md](AGENTS.md); [CLAUDE.md](CLAUDE.md) incorpora esas mismas reglas para Claude Code.
