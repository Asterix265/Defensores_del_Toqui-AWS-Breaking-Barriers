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
          Aurora Serverless v2   S3 capturas            Cognito toqui-prod     SQS toqui-prod-capturas
          PostgreSQL 17          (privado, 7 días,      (grupos, id_jardin)    (+ DLQ, 3 intentos)
          subred aislada, TLS    CORS para la web)                                   │
          secreto en Secrets                                                         ▼
          Manager                         Lambda toqui-prod-proceso (Node 24, ARM64, fuera de la VPC)
                                          texto · audio → Transcribe · foto → Textract
                                          → Guardrail PII → clasificación (fake; Claude pendiente)
                                          → POST /api/interno/capturas/:id/borrador (CloudFront)
```

El diagrama muestra el código de `main` con el cambio `cola-ia-y-amplify`. Lo desplegado todavía usa EventBridge y Step Functions (ver [Estado](#estado)).

## Stacks

| Stack | Ambiente | Contenido |
| --- | --- | --- |
| `ToquiDev` | Desarrollo | Bucket `toqui-dev-capturas-<cuenta>`, Cognito `toqui-dev` (con login por contraseña para pruebas), Guardrail `toqui-dev-pii` |
| `ToquiRed` | Producción | VPC `toqui-prod`: 2 zonas, subredes públicas y aisladas, **sin NAT** |
| `ToquiDatos` | Producción | Aurora Serverless v2 `toqui-prod` (PostgreSQL 17.9, 0,5–4 ACU, cifrado, backup de 1 día) y secreto `toqui-prod/aurora` |
| `ToquiApp` | Producción | API en Fargate + ALB, web en S3 + CloudFront, bucket `toqui-prod-capturas-<cuenta>`, procesamiento (SQS con DLQ y Lambda `toqui-prod-proceso`), secreto `toqui/prod/pipeline-token`, Cognito `toqui-prod` (solo SRP) y Guardrail `toqui-prod-pii` |

`ToquiApp` depende de `ToquiDatos`, que depende de `ToquiRed`. La red y la base se crean una vez; la aplicación se redespliega cada vez que cambia el código.

## Servicios y decisiones

| Servicio | Rol | Decisión |
| --- | --- | --- |
| CloudFront | Entrada única por HTTPS para la web y la API | Evita CORS y HTTPS propio en el ALB (no hay dominio). Una CloudFront Function enruta la SPA; otra quita `/api` antes de llegar a la API |
| S3 (web) | Archivos de la PWA | Privado, acceso solo desde CloudFront (OAC). Se publica con cada despliegue |
| ALB | Balanceo hacia la API | Solo acepta tráfico desde la *prefix list* administrada de CloudFront |
| ECS Fargate | API NestJS stateless | ARM64, 0,5 vCPU / 1 GB, 1–4 tareas con autoescalado por CPU; logs en `/toqui/prod/api` |
| Aurora Serverless v2 | Base PostgreSQL | En subredes aisladas, solo accesible desde la API, TLS verificado con la CA de RDS |
| Secrets Manager | Credenciales de Aurora y token del pipeline | Las credenciales se inyectan al contenedor como variables `DB_*`; el *entrypoint* arma `DATABASE_URL`. `toqui/prod/pipeline-token` (generado por CDK) llega a la API como `PIPELINE_TOKEN` y la Lambda lo lee al arrancar: no aparece en el template |
| S3 (capturas) | Audios, fotos y transcripciones | Privado, borrado a 7 días. Audio y foto en `capturas/`, resultado de Transcribe en `transcripciones/` |
| SQS + Lambda `toqui-prod-proceso` | Procesamiento asíncrono de capturas | Cola con DLQ (`maxReceiveCount: 3`, retención de 14 días), un mensaje por invocación y hasta 5 en paralelo. La Lambda normaliza, anonimiza, clasifica y entrega el borrador al endpoint interno de la API; en el último intento informa el error. Reemplaza a EventBridge, Step Functions y la Lambda `eco` |
| Cognito | Login y roles | Grupos `educadora`/`directora`, atributo `custom:id_jardin` |
| Bedrock + Guardrails | IA y protección de datos personales | Claude Sonnet 5.5 (extracción), Haiku 5.5 (resúmenes); anonimiza nombres, contacto y RUT |
| Transcribe | Audio a texto | `es-US`; trabajo por captura, que se retoma si la cola reintenta |
| Textract | Texto de la foto de una nota | `DetectDocumentText` directo desde S3. Reconoce manuscrito solo en inglés: en español, texto impreso. `LECTOR_FOTO=ia` usa el modelo como respaldo |
| CloudWatch Logs | Registros | `/toqui/prod/api` y `/toqui/prod/proceso`, retención de 2 semanas. La Lambda registra ids, pasos y tiempos, nunca el texto de la nota |

Se eligió S3 + CloudFront en lugar de Amplify Hosting para tener un solo dominio HTTPS para la web y la API y toda la infraestructura en CDK.

## Desplegar y verificar

| Comando | Qué hace |
| --- | --- |
| `pnpm aws:prod:deploy` | Compila web y pipeline y despliega `ToquiRed`, `ToquiDatos` y `ToquiApp` (la imagen de la API se construye con Docker) |
| `pnpm aws:prod:diff` | Muestra qué cambiaría |
| `pnpm aws:prod:smoke` | Verifica web, rutas SPA, API → Aurora y S3, ALB cerrado y procesamiento (encola un trabajo sintético y comprueba en el log que la Lambda llega a la API interna) |
| `pnpm aws:prod:users` | Crea los usuarios sintéticos en el pool de producción |
| `pnpm aws:prod:env` | Imprime las variables de producción |
| `pnpm aws:prod:destroy` | Borra los tres stacks (incluida la base de datos) |

Requisitos: perfil `toqui` con `aws login` y Docker en ejecución. Avisar al equipo antes de desplegar o destruir.

## Estado

Desplegado y verificado el 15-10-2026 con `pnpm aws:prod:smoke` (5/5): web y rutas de la SPA por CloudFront, API en Fargate conectada a Aurora con migraciones aplicadas, ALB cerrado fuera de CloudFront y pipeline S3 → EventBridge → Step Functions → Lambda. URL pública: `pnpm aws:prod:env` o la salida `WebUrl` del stack `ToquiApp`. Usuarios sintéticos creados en el pool de producción con `pnpm aws:prod:users` (misma contraseña de `infra/.env`).

Tiempos del primer despliegue: `ToquiRed` 38 s, `ToquiDatos` 7 min, `ToquiApp` 8 min.

**En el código, sin desplegar** (cambio `cola-ia-y-amplify`): la cola, la DLQ, la Lambda `toqui-prod-proceso` y el secreto del token reemplazan a EventBridge, Step Functions y la Lambda `eco`. Los adaptadores de la Lambda (Transcribe, Textract y Guardrail) se probaron el 15-10-2026 contra `ToquiDev` con datos sintéticos. La API encola en modo `PIPELINE_MODE=cola` (texto al crear, audio y foto con `POST /capturas/:id/subida-completa`), con el catálogo completo de manifestaciones en el mensaje. La clasificación de la Lambda sigue con el proveedor `fake` hasta integrar Claude.

## Pendiente

- Desplegar la cola y la Lambda de proceso (`pnpm aws:prod:deploy`, con aviso al equipo) y verificar con `pnpm aws:prod:smoke`.
- Clasificación con Claude en la Lambda (`IA_PROVIDER=bedrock`).
- Cargar el dataset en Aurora (`pnpm db:seed` con `DATASET_DIR` y la `DATABASE_URL` de producción, o una tarea de ECS).
- Alerta de presupuesto en Billing → Budgets.
- Dominio propio con certificado (opcional).
- CI/CD de despliegue; hoy se despliega desde una máquina del equipo.
- Destruir todo al terminar la hackatón: `pnpm aws:prod:destroy` y `pnpm aws:destroy`.
