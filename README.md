# Defensores del Toqui — AWS Breaking Barriers

Proyecto de la hackatón **AWS Breaking Barriers Chile 2026**, enfocado en Fundación Integra y el desafío **E-1: Ruta de Trayectoria de Aprendizaje**.

La presentación sitúa el evento entre el 14 y el 16 de octubre de 2026, en la Universidad de Chile, Beauchef 851, Santiago.

## Propósito

Devolver tiempo de aula a las educadoras reduciendo el trabajo de documentación y sistematización de observaciones, sin perder la trazabilidad del aprendizaje de cada niño o niña. La presentación denomina esta línea «IA para el Desarrollo Infantil: de la Observación a la Acción».

La línea base declarada en la presentación es de **4 horas semanales** de documentación por educadora; su meta aspiracional es llegar a **0 horas**. Estos valores describen el desafío, no resultados alcanzados por este proyecto.

## Estado actual

La base técnica del monorepo está lista (cambio OpenSpec `levantar-stack-base`): web, API, pipeline, paquete compartido e infraestructura compilan, tienen pruebas de humo y se comunican en local. De `definir-mvp-e1`, la **API** ya implementa el modelo de dominio, la carga del dataset, la autenticación con Cognito (y modo local), la captura con borrador y confirmación, el endpoint interno del pipeline y la trayectoria (ver [API de registro](#api-de-registro)). La Lambda de proceso (`apps/pipeline`, cambio `cola-ia-y-amplify`) ya normaliza con Transcribe y Textract, anonimiza con el Guardrail y entrega al endpoint interno; la clasificación con Claude (`IA_PROVIDER=bedrock`, cambio `clasificador-bedrock`) está en el código, probada con un cliente simulado y en vivo con Claude Sonnet 5, y sin activar en producción. Faltan el encolado desde la API, la conexión de la web a la API y el panel de impacto. Los servicios AWS de desarrollo (stack `ToquiDev`) y la arquitectura de producción (`ToquiRed`, `ToquiDatos`, `ToquiApp`) están desplegados; la API y el pipeline de producción todavía solo tienen los endpoints y pasos técnicos de ejemplo. El cambio `migrar-dataset-nucleos` adopta el dataset E1 por núcleos (modelo, carga, API y adaptación mínima de la IA y la web). Su migración vacía las tablas, y la carga en Aurora (`pnpm aws:prod:seed`) está preparada, pero aún no se ha ejecutado.

## Stack

| Parte | Tecnología | Ubicación |
| --- | --- | --- |
| Web (PWA) | React 19 + Vite + TypeScript, Material UI, TanStack Query, vite-plugin-pwa | `apps/web` |
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
pnpm db:seed                        # carga el dataset E1 por núcleos desde DATASET_DIR (una vez)
pnpm dev                            # web en http://localhost:5173 y API en http://localhost:3000
```

La web abre «Registro Simple». Los niños y niñas, el catálogo, los niveles y los registros vienen de la API (requiere `pnpm db:seed`), y las notas se guardan en ella: texto, audio grabado con el micrófono y foto tomada con la cámara; audio y foto se suben a S3 (requiere `S3_BUCKET_CAPTURAS` y el perfil `toqui` en `apps/api/.env`). La transcripción del audio, la lectura de la foto y la IA aún no están implementadas: la API usa un texto de ejemplo y una propuesta simulada, y la revisión lo avisa. El ingreso es con correo y contraseña de Cognito (ver [ingreso con Cognito](docs/guia-aws.md#ingreso-en-la-web)); sin `apps/web/.env.local` la web usa un ingreso local de prueba contra la API con `AUTH_MODE=local`. Cerrar sesión está en el inicio del celular y en el menú de la educadora del panel. Graben solo audios y fotos sintéticos. En el celular muestra el flujo de la tía (registrar, «Mi sala» con la ficha de cada niño o niña y sus notas por área, con un selector para consultar otra sala del jardín, y «Mis notas»; el botón de grabar de la ficha asocia la nota a ese niño o niña, mientras que Grabar de la barra inferior siempre pide elegirlo) y en pantallas anchas el panel con las pestañas «Mi sala» (niños y niñas por sala y su ficha, con «Nueva nota» para ese niño o niña) y «Mis notas» (tabla de notas confirmadas de las salas y reporte), con el filtro de sala compartido entre ambas. El estado de la API queda en http://localhost:5173/estado. Swagger está en http://localhost:3000/docs. Se usan los puertos por defecto (web 5173, API 3000, Postgres 5432): si otro servicio local ya los ocupa, hay que detenerlo antes de levantar el proyecto.

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Web y API en modo desarrollo |
| `pnpm db:up` / `pnpm db:down` | Inicia o detiene Postgres local |
| `pnpm db:deploy` | Aplica las migraciones existentes sin crear nuevas (primera vez y tras cada `git pull`) |
| `pnpm db:seed` | Carga el dataset E1 por núcleos desde `DATASET_DIR` (carpeta `datos_publicos/`, ver `.env.example`); valida todo antes de escribir y no hace nada si ya está cargado |
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

## API de registro

API NestJS en Fargate (`apps/api`), según `definir-mvp-e1`. Contrato completo en Swagger (`http://localhost:3000/docs`) y en `apps/api/openapi.json`.

| Ruta | Grupo | Qué hace |
| --- | --- | --- |
| `GET /me` | ambos | Identidad, grupo y jardín del token |
| `GET /ninos?sala=` | ambos | Niños y niñas del jardín (nombres ficticios), con sala y nivel educativo |
| `GET /ninos/:id/trayectoria` | ambos | Por núcleo: valoraciones del periodo (sugerido, validado y estado), «sin registros» y observaciones con su evidencia |
| `GET /manifestaciones?nucleo=&nivelEducativo=&nivel=` | ambos | Catálogo de la rúbrica para agregar o quitar manifestaciones |
| `GET /nucleos`, `GET /niveles` | ambos | Los 8 núcleos (con su origen) y los nombres de los 8 niveles |
| `POST /capturas` | educadora | Nota de texto, audio o foto; audio y foto devuelven un PUT firmado a `capturas/<id>.<ext>` |
| `GET /capturas`, `GET /capturas/:id` | ambos | Notas del jardín (filtros de fecha, sala, niño, estado, `mias`) y su borrador |
| `POST /capturas/:id/confirmacion` | educadora | Confirma o corrige (1 a 5 manifestaciones del nivel elegido y del nivel educativo del niño o niña); guarda la corrección y una valoración por núcleo |
| `POST /capturas/:id/descarte` | educadora | Descarta sin crear observación |
| `GET /capturas/:id/archivo` | ambos | URL temporal del original (S3 lo borra a los 7 días) |
| `POST /capturas/:id/subida` | educadora | El audio o la foto ya está en S3: la API lo comprueba y manda la captura a procesar |
| `POST /interno/capturas/:id/borrador` · `/error` | pipeline | Entrega idempotente del borrador; cabecera `x-pipeline-token` = `PIPELINE_TOKEN` |

- Todo queda dentro del jardín del token (`custom:id_jardin`). Un niño o niña de otro jardín responde 403; una captura de otro jardín, 404.
- Solo quien registró una captura la confirma o la descarta.
- **Local** (`.env.example`): `AUTH_MODE=local` usa la educadora fija de `JAR-0001` sin token. Para otros usuarios: `Authorization: Bearer local:directora:JAR-0001`. `PIPELINE_MODE=inline` (por defecto) con `IA_PROVIDER=fake` produce borradores deterministas sin AWS. Audio y foto necesitan `S3_BUCKET_CAPTURAS` (el bucket de `ToquiDev`).
- **AWS** (`PIPELINE_MODE=cola` con `SQS_URL_CAPTURAS`): la API encola cada captura en `toqui-prod-capturas` y la Lambda `toqui-prod-proceso` entrega el borrador al endpoint interno. El texto se encola al crearlo; el audio y la foto, cuando la web llama a `POST /capturas/:id/subida` después del `PUT` a S3 (la API comprueba el archivo: 409 si aún no llega, 422 si el tipo no coincide). Cada captura se encola una sola vez, y si la cola falla queda en `error` con 503.
- `pnpm test` incluye pruebas e2e que crean la base `toqui_test` en el Postgres local (`pnpm db:up` antes).

## Módulo de IA (`packages/ia`)

`@toqui/ia` convierte una nota (escrita, transcrita o leída de una foto) en un `BorradorEntrante` de `@toqui/shared`, con manifestaciones del catálogo recibido y citas literales del texto (cambio OpenSpec `implementar-modulo-ia`). Es lógica pura: no depende de Nest, Prisma, S3 ni de la API, y no lee variables de entorno. La Lambda `proceso` de `apps/pipeline` usa `clasificarConClaude` con `IA_PROVIDER=bedrock` (ver [Clasificación con Claude en la Lambda](#clasificación-con-claude-en-la-lambda-appspipeline)); `crearProveedor` todavía no tiene consumidores. La API mantiene su propio proveedor `fake`.

- `crearProveedor({ proveedor: 'fake' })`: determinista y sin AWS. `crearProveedor({ proveedor: 'bedrock', modelo, region?, guardrail: { id, version } })`: Guardrail → Claude (Converse con la herramienta `registrar_borrador`) → validación → un reintento → evidencia insuficiente. El Guardrail es obligatorio salvo `sinGuardrail: true` (solo desarrollo) y falla cerrado: sin texto anonimizado no se llama al modelo.
- El proveedor expone `extraer(texto, { edadMeses, nivelEsperado, catalogo })` y `normalizarFoto(bytes, 'jpeg' | 'png')` (máximo 3,75 MB). También se exportan `validar`, `normalizarTexto`, `textoDeTranscripcion` (JSON de Transcribe) y `ErrorIa`.
- Niveles y núcleos salen del catálogo recibido (sirve la rúbrica del dataset, 8 niveles × 8 núcleos por nivel educativo, y otras). `nivelEsperado` es el nivel de referencia que arma la API: la mediana de los últimos niveles validados del niño o niña. `textoFuente` es la nota original normalizada; las citas que el modelo toma del texto anonimizado (`{NAME}`) se ubican en el original.
- `clasificarConClaude(cliente, modelo, { textoFuente, edadMeses, nivelEsperado, catalogo, conocimiento?, ejemplos?, correccion? }, { tiempoMaximoMs? })`: una sola llamada a Converse con `registrar_borrador`, sin Guardrail, validación ni reintento (los hace el orquestador del pipeline). Devuelve la salida cruda con la forma `{ nivelSugerido, evidenciaInsuficiente, manifestaciones }` y cada cita como el fragmento literal del texto. Cada llamada se cancela a los 60 s por defecto.
- `ErrorIa` (`codigo`: `FOTO_NO_VALIDA`, `GUARDRAIL_NO_DISPONIBLE` o `CONFIGURACION_INVALIDA`) marca fallas que reintentar no corrige. Los errores del SDK de Bedrock (`ThrottlingException` y otros) se propagan con su nombre para que quien lo use los reintente (en el pipeline, la cola SQS). Una nota sin respaldo no es un error: es un borrador con `evidenciaInsuficiente: true`.

Comandos (verificados el 15-10-2026 en Windows con Node 24.22.0 y pnpm 11.13.0, después de `pnpm --filter @toqui/shared build`):

```sh
pnpm --filter @toqui/ia build
pnpm --filter @toqui/ia typecheck
pnpm --filter @toqui/ia test
```

Las pruebas usan un cliente de Bedrock simulado: no necesitan credenciales ni red. `packages/ia/src/bedrock.live.test.ts` es una prueba manual contra Bedrock real que solo se activa con `RUN_BEDROCK_LIVE=1`, el perfil `toqui` y `BEDROCK_GUARDRAIL_ID`/`BEDROCK_GUARDRAIL_VERSION` (de `pnpm aws:env`); todavía no se ha ejecutado. `packages/ia/src/clasificador.live.test.ts` hace lo mismo con `clasificarConClaude` (tres notas sintéticas; modelo de `BEDROCK_MODEL_EXTRACCION`, por defecto `us.anthropic.claude-sonnet-5`; por consola solo muestra niveles e ids). Se ejecutó el 16-10-2026 con el perfil `toqui`: 3 de 3 con `us.anthropic.claude-sonnet-5`, entre 2,6 y 4,9 s por llamada. Si una llamada falla, las dos pruebas en vivo relanzan solo el nombre y el mensaje del error, para no imprimir la solicitud firmada.

La cuenta del evento solo permite ciertos modelos (política `ws-bedrock-model-allowlist-policy-1`): Claude Sonnet 5, Opus 5 y Fable 5 están permitidos; **Sonnet 5.5 y Haiku 5.5 no** (`AccessDeniedException`). Por eso el modelo de extracción es `us.anthropic.claude-sonnet-5`.

### Clasificación con Claude en la Lambda (`apps/pipeline`)

La Lambda `proceso` elige el clasificador con variables de entorno (`apps/pipeline/src/config.ts`):

- `IA_PROVIDER`: `fake` por defecto (palabras clave, sin AWS) o `bedrock` (`ClasificadorBedrock`, que llama a `clasificarConClaude` con el cliente de Bedrock que ya usa el Guardrail). La validación, el reintento con corrección y la evidencia insuficiente siguen en el orquestador; los errores del SDK se reintentan con la cola.
- `MODELO_EXTRACCION`: modelo o perfil de inferencia, por defecto `us.anthropic.claude-sonnet-5` (igual que `MODELOS.extraccion` de `infra/lib/app-stack.ts`).
- `bedrock` exige `LECTOR_FOTO=textract`: con `LECTOR_FOTO=ia` la configuración se rechaza al arrancar, porque no hay lectura de fotos con Claude en la Lambda.

En producción el valor sale de la constante `IA_PROVIDER_PROCESO` de `infra/lib/app-stack.ts`, que **sigue en `fake`** hasta que salga bien la prueba en vivo. Para activar Claude se cambia esa constante a `'bedrock'` (y su prueba en `infra/lib/prod-stacks.test.ts`) y se redespliega `ToquiApp`. Reversión rápida, sin redesplegar: en la consola de Lambda, `toqui-prod-proceso` → Configuración → Variables de entorno, `IA_PROVIDER=fake`. La Lambda tiene un `timeout` de 180 s (audio: hasta 90 s de Transcribe y hasta dos llamadas a Claude con un tope de 60 s cada una; en la prueba en vivo cada llamada tardó menos de 5 s) y la cola, 1080 s de visibilidad.

Comandos (verificados el 16-10-2026 en Windows con Node 24.22.0 y pnpm 11.13.1; el filtro `...` compila también `@toqui/shared`):

```sh
pnpm --filter "@toqui/ia..." build
pnpm --filter @toqui/pipeline typecheck
pnpm --filter @toqui/pipeline test
pnpm --filter @toqui/pipeline build
```

Las pruebas del pipeline usan un cliente de Bedrock simulado: no necesitan credenciales ni red.

## AWS de desarrollo

Bedrock (Claude y Guardrail), Transcribe, S3 y Cognito están desplegados para desarrollo en la cuenta del evento (`us-east-1`, stack CDK `ToquiDev`). Configuración, comandos (`pnpm aws:smoke`, `pnpm aws:env`, `pnpm aws:deploy`), usuarios de prueba, costos y limpieza: [guía AWS](docs/guia-aws.md).

El ambiente de producción (web en Amplify; API por CloudFront → ALB interno → Fargate; Aurora Serverless v2; procesamiento con SQS y Lambda) se despliega con `pnpm aws:prod:deploy`; diagrama, stacks y decisiones en [arquitectura AWS](docs/arquitectura-aws.md).

## Materiales del desafío

Los originales se mantienen en la carpeta hermana `../Desafio/`; no se copian al repositorio.

| Recurso | Ubicación relativa a este repositorio |
| --- | --- |
| Presentación de Integra | `../Desafio/bb-assets-e1-presentation.pptx` |
| Dataset E1 por núcleos (v1.0.0, el que usa la app) | `../dataset_e1_nucleos_2026/` (`dataset_e1_nucleos_2026.zip`, recibido el 16-10-2026) |
| Diccionario, metodología y rúbricas | `../dataset_e1_nucleos_2026/diccionario_datos.md`, `metodologia.md`, `rubricas/` |
| Dataset público anterior (9 niveles, 5 dominios; reemplazado) | `../Desafio/dataset_e1_publico/` |

Portal proporcionado: [Fundación Integra — desafíos](https://d78v2swml9yu2.cloudfront.net/?inst=integra).

Quien clone solo este repositorio deberá obtener los materiales públicos y ubicarlos en una carpeta hermana `Desafio`, o documentar su ubicación alternativa. El [contexto del desafío](docs/contexto-desafio.md) resume las fuentes y sus diferencias; el [contexto de la hackatón](docs/contexto-hackaton.md) reúne cronograma, criterios de evaluación, enunciado E-1 y resumen del dataset.

## Dataset disponible

Dataset sintético **E1 por núcleos de aprendizaje** v1.0.0 (cambio `migrar-dataset-nucleos`): elaborado el 16-10-2026, con datos observados hasta el 15-10-2026. Reemplaza al dataset público anterior (9 niveles y 5 dominios) y **cambia el esquema**: 8 núcleos, escala 1–8 dentro de cada núcleo y nivel educativo (Sala Cuna, Nivel Medio y Transición), evidencia con fragmento literal y valoraciones con nivel sugerido y validado. No se convierte la escala anterior.

Conteos verificados con `pnpm db:seed` el 16-10-2026:

| Entidad | Registros |
| --- | ---: |
| Jardines · salas · personas | 3 · 18 · 57 |
| Niños y niñas | 252 |
| Descriptores de rúbrica (8 núcleos × 3 niveles educativos × 8 niveles) | 192 |
| Manifestaciones (conducta y 2 ejemplos por descriptor) | 576 |
| Observaciones (todas `texto`) | 11.400 |
| Evidencias (fragmentos) | 13.026 |
| Valoraciones (3 fechas de corte) | 5.760 |

Solo Identidad y Autonomía es referencia aportada. Los otros 7 núcleos son propuestas sintéticas sin aprobación institucional. Los formatos `audio`, `foto` y `video` son metadatos: **no se entregan archivos multimedia**. La ausencia de un registro no implica ausencia de aprendizaje, y los niveles no son diagnósticos. Modelo y reglas: [modelo de datos](docs/modelo-datos.md).

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

1. Completar `definir-mvp-e1`: pipeline con Transcribe y Bedrock que entregue al endpoint interno, conectar la web a la API y medir el impacto. En `ToquiApp` falta desplegar la cola y la Lambda de proceso (el `PIPELINE_TOKEN` ya va en Secrets Manager) y cargar el dataset en Aurora.
2. Resolver cómo representar la rúbrica institucional frente a la ruta sintética del dataset.
3. Configurar IAM, acceso a modelos de Bedrock y despliegue en AWS, documentando permisos, costos y limpieza.
4. Medir tiempo de documentación y trazabilidad con datos sintéticos; reportar resultados reales de la demo.

Las reglas de colaboración están en [AGENTS.md](AGENTS.md); [CLAUDE.md](CLAUDE.md) incorpora esas mismas reglas para Claude Code.
