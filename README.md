# Defensores del Toqui — AWS Breaking Barriers

Proyecto de la hackatón **AWS Breaking Barriers Chile 2026**, enfocado en Fundación Integra y el desafío **E-1: Ruta de Trayectoria de Aprendizaje**.

La presentación sitúa el evento entre el 14 y el 16 de octubre de 2026, en la Universidad de Chile, Beauchef 851, Santiago.

## Propósito

Devolver tiempo de aula a las educadoras reduciendo el trabajo de documentación y sistematización de observaciones, sin perder la trazabilidad del aprendizaje de cada niño o niña. La presentación denomina esta línea «IA para el Desarrollo Infantil: de la Observación a la Acción».

La línea base declarada en la presentación es de **4 horas semanales** de documentación por educadora; su meta aspiracional es llegar a **0 horas**. Estos valores describen el desafío, no resultados alcanzados por este proyecto.

## Estado actual

La base técnica del monorepo está lista (cambio OpenSpec `levantar-stack-base`). La arquitectura vigente es la v1 de clasificación de observaciones (Lambda API + SQS + Lambda de proceso). La **Lambda API** está implementada y probada en local (cambio `implementar-lambda-api`, ver [API de observaciones](#api-de-observaciones)); faltan la Lambda de proceso (IA), la web y la infraestructura. No hay recursos desplegados en AWS.

## Stack

| Parte | Tecnología | Ubicación |
| --- | --- | --- |
| Web (PWA) | React 19 + Vite + TypeScript, TanStack Query, vite-plugin-pwa | `apps/web` |
| API | NestJS 11 + Prisma 7 (PostgreSQL), nestjs-zod, Swagger | `apps/api` |
| Pipeline | Handlers Lambda en TypeScript (esbuild, `nodejs24.x`) | `apps/pipeline` |
| Contrato | Esquemas zod → OpenAPI → cliente orval (hooks y mocks MSW) | `packages/shared` |
| Infraestructura | AWS CDK v2 en TypeScript, `us-east-1` (solo síntesis) | `infra` |
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

Si ya tenías `apps/api/.env` de antes de la API de observaciones, agrégale `AUTH_MODO=dev` (o vuelve a copiar `.env.example`): sin esa línea la API exige Cognito y no arranca en local.

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

Imagen de la API (desde la raíz): `docker build -f apps/api/Dockerfile -t toqui-api .`

Al cambiar un esquema de `packages/shared` o un endpoint, ejecutar `pnpm contract` y versionar el resultado: la CI falla si el contrato generado queda desactualizado. La CI (`.github/workflows/ci.yml`) ejecuta lint, formato, tipos, pruebas, build, contrato y síntesis en cada pull request.

Verificado el 14-10-2026 en macOS con Node 24.22.0 y pnpm 11.13.0, en una copia limpia del repositorio. Falta confirmar en Windows y Linux, y la primera ejecución de la CI en GitHub.

## API de observaciones

La Lambda API (`apps/api`, entrada `src/lambda.ts`) solo valida, autoriza, firma URLs de S3 y encola en SQS; todo el procesamiento ocurre en la Lambda de proceso. El contrato completo está en Swagger (`http://localhost:3000/docs`) y en `apps/api/openapi.json`.

| Ruta | Rol | Qué hace |
| --- | --- | --- |
| `GET /me`, `GET /criterios` | ambos | Usuario y rol; lista fija de criterios |
| `POST /subidas` | registrador | POST firmado de S3 (5 min, tipo y tamaño ≤ 10 MB) en `subidas/<sub>/` |
| `POST /observaciones` | registrador | Crea la observación pendiente (texto o archivo subido) y la encola |
| `GET /observaciones/:id` | ambos | Estado y propuesta (criterio, confianza, 2 opciones, audio de Polly) |
| `POST /observaciones/:id/revision` | registrador | Confirma o corrige; 409 si ya fue validada |
| `GET /mi-dia?fecha=` | registrador | Sus observaciones del día |
| `GET /panel/observaciones`, `GET /panel/resumen` | supervisor | Lista filtrada y paginada; totales del día |
| `POST /observaciones/:id/validacion` | supervisor | Valida o corrige y cierra la observación |
| `GET /observaciones/:id/archivo` | ambos | URL temporal del original (registrador: solo los suyos) |

- El rol sale del grupo de Cognito del token (`registrador` o `supervisor`); otro rol recibe 403. Las observaciones ajenas responden 404.
- En local, `AUTH_MODO=dev` acepta `Authorization: Bearer dev:registrador:ana` (o `dev:supervisor:...`). La configuración rechaza ese modo en producción.
- Sin `S3_BUCKET` las subidas responden 503; sin `SQS_QUEUE_URL` las observaciones quedan pendientes. Ver `.env.example`.
- La tabla `criterios` no tiene datos: la lista fija aún no está definida.
- `pnpm test` incluye pruebas e2e que crean la base `toqui_test` en el Postgres local (`pnpm db:up` antes).

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

1. Lambda de proceso (Transcribe/Textract, Titan + pgvector, Nova, Polly), infraestructura CDK de la API y la web; definir la lista de criterios.
2. Resolver cómo representar la rúbrica institucional frente a la ruta sintética del dataset.
3. Configurar IAM, acceso a modelos de Bedrock y despliegue en AWS, documentando permisos, costos y limpieza.
4. Medir tiempo de documentación y trazabilidad con datos sintéticos; reportar resultados reales de la demo.

Las reglas de colaboración están en [AGENTS.md](AGENTS.md); [CLAUDE.md](CLAUDE.md) incorpora esas mismas reglas para Claude Code.
