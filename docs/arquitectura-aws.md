# Arquitectura AWS

Toda la infraestructura del proyecto está en `infra/` como código (AWS CDK, TypeScript), en la cuenta del evento, región **`us-east-1`**. Hay dos ambientes: **desarrollo** (servicios compartidos que el equipo usa desde su máquina) y **producción** (la demo desplegada).

## Diagrama (producción)

```
                         Educadora (celular / navegador)
                                     │ HTTPS
                                     ▼
                     CloudFront (un solo dominio *.cloudfront.net)
                       │ /*  (función: rutas SPA)          │ /api/*  (función: quita /api)
                       ▼                                    ▼
             S3 web (privado, OAC)            ALB (solo acepta la prefix list de CloudFront)
             PWA React + Vite                               │
                                                            ▼
                                   ECS Fargate ARM64: NestJS + Prisma (1–4 tareas, CPU 60 %)
                                    │ al arrancar: prisma migrate deploy
                     ┌──────────────┼──────────────────────────┬─────────────────────┐
                     ▼              ▼                          ▼                     ▼
          Aurora Serverless v2   S3 capturas            Cognito toqui-prod     Bedrock Claude
          PostgreSQL 17          (privado, 7 días,      (grupos, id_jardin)    + Guardrail PII
          subred aislada, TLS    CORS para la web)                             Transcribe
          secreto en Secrets           │ Object Created (capturas/)
          Manager                      ▼
                                 EventBridge ──► Step Functions «toqui-captura»
                                                   │ preparar ─► (audio: Transcribe | foto: leer foto)
                                                   │ ─► extraer (Guardrail + Claude) ─► entregar
                                                   ▼
                                 Lambdas (Node 24, ARM64, fuera de la VPC) ──► CloudFront /api/interno
                                                                               (x-pipeline-token)
```

## Stacks

| Stack | Ambiente | Contenido |
| --- | --- | --- |
| `ToquiDev` | Desarrollo | Bucket `toqui-dev-capturas-<cuenta>`, Cognito `toqui-dev` (con login por contraseña para pruebas), Guardrail `toqui-dev-pii` |
| `ToquiRed` | Producción | VPC `toqui-prod`: 2 zonas, subredes públicas y aisladas, **sin NAT** |
| `ToquiDatos` | Producción | Aurora Serverless v2 `toqui-prod` (PostgreSQL 17.9, 0,5–4 ACU, cifrado, backup de 1 día) y secreto `toqui-prod/aurora` |
| `ToquiApp` | Producción | API en Fargate + ALB, web en S3 + CloudFront, bucket `toqui-prod-capturas-<cuenta>`, pipeline (EventBridge, Step Functions, 5 Lambdas), secreto `toqui-prod/pipeline-token`, Cognito `toqui-prod` (SRP para la web; login de administración solo para pruebas de humo) y Guardrail `toqui-prod-pii` |

`ToquiApp` depende de `ToquiDatos`, que depende de `ToquiRed`. La red y la base se crean una vez; la aplicación se redespliega cada vez que cambia el código.

## Servicios y decisiones

| Servicio | Rol | Decisión |
| --- | --- | --- |
| CloudFront | Entrada única por HTTPS para la web y la API | Evita CORS y HTTPS propio en el ALB (no hay dominio). Una CloudFront Function enruta la SPA; otra quita `/api` antes de llegar a la API |
| S3 (web) | Archivos de la PWA | Privado, acceso solo desde CloudFront (OAC). Se publica con cada despliegue |
| ALB | Balanceo hacia la API | Solo acepta tráfico desde la *prefix list* administrada de CloudFront |
| ECS Fargate | API NestJS stateless | ARM64, 0,5 vCPU / 1 GB, 1–4 tareas con autoescalado por CPU; logs en `/toqui/prod/api` |
| Aurora Serverless v2 | Base PostgreSQL | En subredes aisladas, solo accesible desde la API, TLS verificado con la CA de RDS |
| Secrets Manager | Credenciales de Aurora y `PIPELINE_TOKEN` | Las credenciales se inyectan al contenedor como `DB_*` (el *entrypoint* arma `DATABASE_URL`). El token generado se inyecta a la API y las Lambdas lo leen en ejecución, sin quedar en la plantilla |
| S3 (capturas) | Audios, fotos, textos y transcripciones | Privado, borrado a 7 días, eventos a EventBridge. Solo `capturas/` inicia el pipeline; Transcribe escribe en `transcripciones/` |
| EventBridge + Step Functions + Lambda | Pipeline de IA asíncrono | Una captura bajo `capturas/` inicia `toqui-captura`: `preparar` pide el contexto a la API (y omite capturas ya decididas), el audio va a Transcribe con la integración nativa (espera sin Lambda encendida), la foto a `describir-foto`, y `extraer` + `entregar` devuelven el borrador. Errores de red, 5xx y límites de Bedrock se reintentan con espera; cualquier otro fallo termina en `informar-error`, que deja la captura en `error` con un mensaje para la educadora |
| Cognito | Login y roles | Grupos `educadora`/`directora`, atributo `custom:id_jardin` |
| Bedrock + Guardrails | IA y protección de datos personales | `ApplyGuardrail` anonimiza nombres, contacto y RUT antes del modelo; Claude Sonnet 5.5 extrae con una herramienta de salida estructurada y lee fotos. Haiku 5.5 queda para resúmenes |
| Transcribe | Audio a texto (`es-US`) | Lo invoca Step Functions; el rol de la máquina lee `capturas/*` y escribe `transcripciones/*` |
| CloudWatch Logs | Registros | API y pipeline, retención de 2 semanas |

Se eligió S3 + CloudFront en lugar de Amplify Hosting para tener un solo dominio HTTPS para la web y la API y toda la infraestructura en CDK.

## Desplegar y verificar

| Comando | Qué hace |
| --- | --- |
| `pnpm aws:prod:deploy` | Compila web y pipeline y despliega `ToquiRed`, `ToquiDatos` y `ToquiApp` (la imagen de la API se construye con Docker) |
| `pnpm aws:prod:diff` | Muestra qué cambiaría |
| `pnpm aws:prod:seed` | Carga el dataset en Aurora con una tarea puntual de ECS (`DATASET_DIR=<carpeta de los CSV>`); no hace nada si ya está cargado |
| `pnpm aws:prod:smoke` | Verifica web, rutas SPA, API → Aurora, ALB cerrado y el flujo completo como educadora: texto, audio (Transcribe) y foto (Claude) hasta el borrador. Descarta sus notas al final |
| `pnpm aws:prod:users` | Crea los usuarios sintéticos en el pool de producción |
| `pnpm aws:prod:env` | Imprime las variables de producción |
| `pnpm aws:prod:destroy` | Borra los tres stacks (incluida la base de datos) |

Requisitos: perfil `toqui` con `aws login` y Docker en ejecución. Avisar al equipo antes de desplegar o destruir.

## Estado

Desplegado y verificado el 15-10-2026 con `pnpm aws:prod:smoke` (5/5): web y rutas de la SPA por CloudFront, API en Fargate conectada a Aurora con migraciones aplicadas, ALB cerrado fuera de CloudFront y pipeline S3 → EventBridge → Step Functions → Lambda. URL pública: `pnpm aws:prod:env` o la salida `WebUrl` del stack `ToquiApp`. Usuarios sintéticos creados en el pool de producción con `pnpm aws:prod:users` (misma contraseña de `infra/.env`).

El pipeline con IA (rama `feat/pipeline-ia`, 15-10-2026) está implementado y probado en local; falta desplegarlo con `pnpm aws:prod:deploy`, cargar el dataset con `pnpm aws:prod:seed` y verificarlo con `pnpm aws:prod:smoke`.

Tiempos del primer despliegue: `ToquiRed` 38 s, `ToquiDatos` 7 min, `ToquiApp` 8 min.

## Pendiente

- Conectar la web a la API con Cognito (hoy la web es un mock con datos sintéticos).
- Reducir las fotos en el navegador antes de subirlas: Claude lee hasta 3,75 MB y el pipeline no incluye `sharp`.
- Alerta de presupuesto en Billing → Budgets.
- Dominio propio con certificado (opcional).
- CI/CD de despliegue; hoy se despliega desde una máquina del equipo.
- Destruir todo al terminar la hackatón: `pnpm aws:prod:destroy` y `pnpm aws:destroy`.
