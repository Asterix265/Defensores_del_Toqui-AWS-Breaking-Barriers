# Arquitectura AWS

Toda la infraestructura del proyecto está en `infra/` como código (AWS CDK, TypeScript), en la cuenta del evento, región **`us-east-1`**. Hay dos ambientes: **desarrollo** (servicios compartidos que el equipo usa desde su máquina) y **producción** (la demo desplegada).

## Diagrama (producción)

```
                         Educadora (celular / navegador)
                                     │ HTTPS
                                     ▼
              Amplify Hosting (main.dgsos3g6dvh6h.amplifyapp.com): PWA React + Vite
                                     │ /api/*  (regla de reescritura, conserva Authorization)
                                     ▼
                     CloudFront (*.cloudfront.net, entrada HTTPS de la API)
                                     │ VPC Origin: por la red de AWS, sin pasar por internet
                                     ▼
                     ALB interno (subredes aisladas, sin IP pública)
                                     │
                                     ▼
            ECS Fargate ARM64: NestJS + Prisma (1–4 tareas, CPU 60 %), salida solo 443 y 5432
              contenedor `migraciones` (administrador) → migraciones + usuario toqui_app → API
                     ┌──────────────┼──────────────────────────┬─────────────────────┐
                     ▼              ▼                          ▼                     ▼
          Aurora Serverless v2   S3 capturas            Cognito toqui-prod     SQS toqui-prod-capturas
          PostgreSQL 17          (privado, 7 días,      (grupos, id_jardin)    (+ DLQ, 3 intentos)
          subred aislada, TLS,   CORS solo Amplify)                                  │
          API como toqui_app                                                         ▼
          (sin DDL)                       Lambda toqui-prod-proceso (Node 24, ARM64, fuera de la VPC)
                                          texto · audio → Transcribe · foto → Textract
                                          → Guardrail PII → clasificación (fake; Claude pendiente)
                                          → POST /api/interno/capturas/:id/borrador (CloudFront)
```

El diagrama es lo desplegado desde el 16-10-2026 (cambios `cola-ia-y-amplify`, `endurecer-seguridad-aws` y `migrar-dataset-nucleos`; ver [Estado](#estado)).

## Stacks

| Stack | Ambiente | Contenido |
| --- | --- | --- |
| `ToquiDev` | Desarrollo | Bucket `toqui-dev-capturas-<cuenta>`, Cognito `toqui-dev` (con login por contraseña para pruebas), Guardrail `toqui-dev-pii` |
| `ToquiRed` | Producción | VPC `toqui-prod`: 2 zonas, subredes públicas y aisladas, **sin NAT** |
| `ToquiDatos` | Producción | Aurora Serverless v2 `toqui-prod` (PostgreSQL 17.9, 0,5–4 ACU, cifrado, backup de 1 día), secreto del administrador `toqui-prod/aurora` y secreto de la API `toqui-prod/aurora-app` (`toqui_app`) |
| `ToquiApp` | Producción | API en Fargate detrás de un ALB interno, CloudFront con VPC Origin, bucket `toqui-prod-capturas-<cuenta>`, procesamiento (SQS con DLQ y Lambda `toqui-prod-proceso`), secreto `toqui/prod/pipeline-token`, Cognito `toqui-prod` (solo SRP) y Guardrail `toqui-prod-pii`. La web está en Amplify (app `dgsos3g6dvh6h`, fuera de CDK) |

`ToquiApp` depende de `ToquiDatos`, que depende de `ToquiRed`. La red y la base se crean una vez; la aplicación se redespliega cada vez que cambia el código.

## Servicios y decisiones

| Servicio | Rol | Decisión |
| --- | --- | --- |
| Amplify Hosting | Web (PWA) | Se compila y publica sola en cada push a `main` (`amplify.yml`). Reenvía `/api/*` a CloudFront; reglas y variables con `pnpm aws:prod:amplify` |
| CloudFront | Entrada HTTPS de la API | HTTPS sin dominio propio (el ALB no puede tener certificado de ACM sin dominio). Llega al ALB por un VPC Origin. Una CloudFront Function quita `/api` antes de llegar a la API |
| ALB | Balanceo hacia la API | Interno, en las subredes aisladas, sin IP pública: solo lo alcanza el VPC Origin de CloudFront |
| ECS Fargate | API NestJS stateless | ARM64, 0,5 vCPU / 1 GB, 1–4 tareas con autoescalado por CPU; logs en `/toqui/prod/api`. Subred pública con IP pública (sin NAT), pero el SG solo deja entrar desde el ALB y salir por 443 y por 5432 hacia Aurora |
| Aurora Serverless v2 | Base PostgreSQL | En subredes aisladas, solo accesible desde la API, TLS verificado con la CA de RDS. La API usa `toqui_app` (solo `SELECT`, `INSERT`, `UPDATE` y `DELETE`); el contenedor `migraciones` aplica las migraciones y crea ese usuario con el administrador antes de cada arranque |
| Secrets Manager | Credenciales de Aurora y token del pipeline | Se inyectan como variables `DB_*`; el *entrypoint* arma `DATABASE_URL`. El administrador solo llega al contenedor `migraciones`. `toqui/prod/pipeline-token` (generado por CDK) llega a la API como `PIPELINE_TOKEN` y la Lambda lo lee al arrancar: no aparece en el template |
| S3 (capturas) | Audios, fotos y transcripciones | Privado, borrado a 7 días, CORS solo para Amplify. Audio y foto en `capturas/`, resultado de Transcribe en `transcripciones/`. A los 7 días la API también vacía en la base el texto original y la referencia al archivo; se conserva el texto anonimizado del borrador |
| SQS + Lambda `toqui-prod-proceso` | Procesamiento asíncrono de capturas | Cola con DLQ (`maxReceiveCount: 3`, retención de 14 días), un mensaje por invocación y hasta 5 en paralelo. La Lambda normaliza, anonimiza, clasifica y entrega el borrador al endpoint interno de la API; en el último intento informa el error. Reemplaza a EventBridge, Step Functions y la Lambda `eco` |
| Cognito | Login y roles | Grupos `educadora`/`directora`, atributo `custom:id_jardin` |
| Bedrock + Guardrails | IA y protección de datos personales | Claude Sonnet 5.5 (extracción) y Haiku 5.5 (resúmenes) previstos; la Lambda ya tiene permiso, pero clasifica con `IA_PROVIDER=fake`. El Guardrail anonimiza nombres, contacto y RUT y sí se aplica a cada nota |
| Transcribe | Audio a texto | `es-US`; trabajo por captura, que se retoma si la cola reintenta |
| Textract | Texto de la foto de una nota | `DetectDocumentText` directo desde S3. Reconoce manuscrito solo en inglés: en español, texto impreso. `LECTOR_FOTO=ia` usa el modelo como respaldo |
| CloudWatch Logs | Registros | `/toqui/prod/api` y `/toqui/prod/proceso`, retención de 2 semanas. La Lambda registra ids, pasos y tiempos, nunca el texto de la nota |

## Seguridad (cambio `endurecer-seguridad-aws`)

| Capa | Regla |
| --- | --- |
| Tránsito | Internet → Amplify y CloudFront por HTTPS; CloudFront → ALB por VPC Origin dentro de la red de AWS. Ningún token viaja en claro por internet |
| Red | ALB y Aurora en subredes aisladas. SG del ALB: entrada 80 desde la *prefix list* de CloudFront, salida 3000 a la API. SG de la API: entrada 3000 desde el ALB, salida 443 a internet y 5432 a Aurora. SG de Aurora: entrada 5432 desde la API |
| IAM de la API | `s3:PutObject` y `s3:GetObject` en `capturas/*`, `s3:GetObject` en `dataset/*` (carga con `pnpm aws:prod:seed`), `s3:ListBucket` en el bucket, envío y atributos de la cola. Sin borrado en S3, sin `transcripciones/` y sin Bedrock |
| IAM de la Lambda | Lectura de `capturas/*` y `transcripciones/*`, escritura en `transcripciones/*`, Transcribe, Textract, Bedrock y Guardrail, y el token del pipeline |
| Base | La API no puede crear, modificar ni borrar tablas. Borrar una captura borra su borrador, corrección y eventos; la observación confirmada se conserva |
| Retención | Audio, foto y transcripción: 7 días en S3. Texto original y referencia al archivo: 7 días en la base |

## Desplegar y verificar

| Comando | Qué hace |
| --- | --- |
| `pnpm aws:prod:deploy` | Compila el pipeline y despliega `ToquiRed`, `ToquiDatos` y `ToquiApp` (la imagen de la API se construye con Docker). La web se publica sola en Amplify |
| `pnpm aws:prod:diff` | Muestra qué cambiaría |
| `pnpm aws:prod:smoke` | Verifica la web y el proxy `/api` en Amplify, API → Aurora y S3 por CloudFront, ALB sin acceso directo y procesamiento (encola un trabajo sintético y comprueba en el log que la Lambda llega a la API interna) |
| `pnpm aws:prod:users` | Crea los usuarios sintéticos en el pool de producción |
| `pnpm aws:prod:env` | Imprime las variables de producción |
| `pnpm aws:prod:seed --dataset <datos_publicos> [--dry-run]` | Sube los 15 CSV del dataset E1 por núcleos a `dataset/<huella>/` del bucket de capturas y lanza una tarea Fargate única (definición de la API, `--cargar-dataset`) que los carga en Aurora con `toqui_app`. Espera a que termine e informa el código de salida y el flujo de log; si la espera falla (15 minutos o un error), detiene la tarea. Se niega a lanzarla, también con `--dry-run`, si `ToquiApp` no está en `CREATE_COMPLETE` o `UPDATE_COMPLETE` (por ejemplo, tras un rollback) o no expone la salida `PrefijoDataset`: su definición de tarea podría no conocer `--cargar-dataset` y arrancaría la API. Con `--dry-run` solo muestra el plan. No hace nada si la base ya tiene jardines |
| `pnpm aws:prod:destroy` | Borra los tres stacks (incluida la base de datos) |

Requisitos: perfil `toqui` con `aws login` y Docker en ejecución. Avisar al equipo antes de desplegar o destruir.

La imagen de la API es ARM64 y necesita Docker con **buildx** (BuildKit): el constructor clásico falla con `does not provide the specified platform (linux/arm64)`. En un equipo x86_64 además hace falta emulación (`docker run --privileged --rm tonistiigi/binfmt --install arm64`; se pierde al reiniciar). Docker Desktop trae ambos. En Linux sin el plugin, se instala el binario de [docker/buildx](https://github.com/docker/buildx/releases) en `~/.docker/cli-plugins/docker-buildx`. Con emulación, la imagen tarda unos minutos más.


Desplegado y verificado el 16-10-2026, de madrugada, con los cambios `cola-ia-y-amplify`, `endurecer-seguridad-aws` y `migrar-dataset-nucleos`. Web en `https://main.dgsos3g6dvh6h.amplifyapp.com`. La URL de la API (CloudFront) está en `pnpm aws:prod:env` o en la salida `WebUrl` de `ToquiApp`. Usuarios sintéticos del pool de producción: `pnpm aws:prod:users`, con la contraseña de `infra/.env`.

- `pnpm aws:prod:smoke`: 5/5 pasos correctos. Cubre la web y las rutas de la SPA en Amplify, el proxy `/api`, la API conectada a Aurora y S3, el ALB inalcanzable desde internet, y un trabajo sintético SQS → Lambda → API interna, con el token aceptado.
- Contenedor `migraciones`: aplicó `20261016100000_dataset_nucleos`, que vació las tablas, y creó `toqui_app`.
- `pnpm aws:prod:seed`: cargó el dataset E1 por núcleos v1.0.0, con los mismos conteos que en local. Son 3 jardines, 57 educadoras, 18 salas, 252 niños y niñas, 192 descriptores, 576 manifestaciones, 11.400 observaciones, 13.026 evidencias y 5.760 valoraciones.
- Prueba de punta a punta con `educadora.jar0001@example.com`, por la web de Amplify:
  - el ingreso SRP en Cognito y `/me`, `/ninos`, la trayectoria y `/nucleos` funcionan;
  - una nota de texto llega a `borrador_listo` por la cola y la Lambda, con la clasificación `fake`;
  - la nota de prueba se descartó después.
- No verificado en producción: audio y foto (subida a S3, Transcribe y Textract) y el uso desde un navegador real.

Tiempos del 16-10-2026: `ToquiApp`, 8 min (reemplaza el ALB y crea el VPC Origin); la carga del dataset, unos 3 min. Los del primer despliegue, el 15-10: `ToquiRed` 38 s, `ToquiDatos` 7 min y `ToquiApp` 8 min.

Lecciones del despliegue. Los tres intentos anteriores terminaron en `UPDATE_ROLLBACK_COMPLETE` por estas causas:
- `ALTER ROLE ... NOSUPERUSER` falla en Aurora: el administrador es `rds_superuser`, no superusuario, y Postgres le impide tocar ese atributo. Ahora el entrypoint no lo usa, y un rol creado así ya es `NOSUPERUSER`. En el Postgres local de Docker no se ve, porque ahí el administrador sí es superusuario.
- Al reemplazar el ALB público por el interno, el listener nuevo no podía usar el *target group* del ALB anterior, porque un *target group* no puede estar en dos ALB. Se resolvió con un id lógico nuevo (`ApiTgInterno`).
- En un equipo x86_64 sin buildx, la imagen ARM64 no se construye (ver [Desplegar y verificar](#desplegar-y-verificar)).

Un rollback de `ToquiApp` no revierte las migraciones ya aplicadas. Sobre la migración `dataset_nucleos`, ver el plan de rollback en `openspec/changes/migrar-dataset-nucleos/design.md`.

Costo de la carga: una tarea Fargate de pocos minutos y unos 12 MB en `dataset/` del bucket de capturas, que se borran a los 7 días.

## Pendiente

- Clasificación con Claude en la Lambda (`IA_PROVIDER=bedrock` con `@toqui/ia`).
- Probar audio y foto en producción desde la web: subida firmada (CORS), Transcribe y Textract.
- Avisos a la web (AppSync Events) y memoria y Knowledge Base (`cola-ia-y-amplify`, secciones 6 y 8).
- Alerta de presupuesto en Billing → Budgets.
- Dominio propio con certificado (opcional).
- CI/CD de despliegue; hoy se despliega desde una máquina del equipo.
- Destruir todo al terminar la hackatón: `pnpm aws:prod:destroy` y `pnpm aws:destroy`.
