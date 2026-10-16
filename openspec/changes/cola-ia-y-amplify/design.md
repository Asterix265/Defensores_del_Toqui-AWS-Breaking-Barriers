## Context

Estado en `main` el 15-10-2026 (ver `docs/arquitectura-aws.md`):

- `ToquiApp` en `us-east-1` tiene CloudFront (con `/*` hacia el S3 web y `/api/*` hacia el ALB), la API NestJS en Fargate con IP pública y sin NAT, el bucket de capturas con eventos hacia EventBridge, la máquina de Step Functions `toqui-captura` con la Lambda `eco`, Cognito `toqui-prod` y el Guardrail `toqui-prod-pii`.
- Aurora está en subredes aisladas: solo la API llega a ella.
- La API ya incluye:
  - capturas (`crear`, `confirmacion`, `descarte`) y URLs firmadas `PUT` con claves `capturas/<id>.<ext>`;
  - el endpoint interno `POST /interno/capturas/:id/{borrador,error}` con `PIPELINE_TOKEN`, que es idempotente porque el borrador es único por captura;
  - el modo `inline` con el proveedor `fake`.
- `PIPELINE_MODE=aws` escribe las notas de texto en S3 solo para disparar EventBridge.

Motivación y alcance en `proposal.md`. Requisitos en `specs/`.

## Goals / Non-Goals

**Goals:**

- Un único camino de procesamiento en producción: API → SQS → Lambda → API, con avisos y memoria.
- Un despachador intercambiable en la API: la cola en producción e `inline` en local, con el mismo contrato.
- Que la Lambda no necesite la base: todo lo que usa viaja en el mensaje o se consulta en servicios administrados.
- Que la web se publique sola desde `main`.

**Non-Goals:**

- Lambdas dentro de la VPC, RDS Data API, NAT o VPC endpoints.
- Despliegue de CDK desde GitHub Actions, protección de rama y aprobación manual.
- Video, reentrenamiento y evaluación completa (`pnpm eval`).
- Conectar el resto de la web con la API y el login (otro frente de trabajo; este cambio entrega el cliente de avisos y la integración con la propuesta).

## Decisions

### D1. Despachador en la API: `cola` o `inline`

La interfaz `Despachador.programar(mensaje)` tiene dos implementaciones:

- `cola`: `SendMessage` a SQS;
- `inline`: el servicio actual con `fake`.

`PIPELINE_MODE` pasa de `aws | inline` a `cola | inline`. Con `cola` se exige `SQS_URL_CAPTURAS`.

Se eliminan `guardarTexto` y la regla de EventBridge, así que el texto ya no pasa por S3.

- *Alternativa:* mantener S3 → EventBridge como disparador. Se descarta porque obliga a escribir el texto en S3 y no permite saber cuándo se completó una subida desde la web.

### D2. Cuándo se encola

- **Texto:** al crear la captura.
- **Audio y foto:** en `POST /capturas/:id/subida` (el aviso de subida de `persistir-capturas`, que ya usa la web). La API comprueba con `HeadObject` que el objeto exista (409 si aún no llega) y que su tipo sea el declarado (422); el tamaño ya lo exige la firma del `PUT`.
- **Idempotencia:** una columna nueva `capturas.encolada_en` se actualiza con un `updateMany` condicionado a `encolada_en IS NULL`. Solo quien logra el cambio encola.
- **Si `SendMessage` falla:** la captura pasa a `error` y la API responde 503, igual que en el patrón actual.

### D3. Mensaje autosuficiente

`MensajeCapturaSchema` (zod, en `packages/shared`) contiene:

- `idCaptura` e `idUsuario` (el `sub` de Cognito, un identificador opaco que se usa solo para el canal de avisos);
- `idJardin`, `formato`, `texto` o `archivoClave` y `archivoTipo`;
- `edadMeses` y `nivelEsperado`;
- `catalogo`: **todas** las manifestaciones de la ruta, con `id`, `nivel`, `dominio` y `textoObservable` (90 entradas, unos 15 KB, dentro del límite de 256 KB de SQS). El 15-10-2026 el equipo quitó la ventana «nivel esperado ±1» de D7 de `definir-mvp-e1`: no venía de los datos y impedía proponer un nivel alejado de lo esperado para la edad. `edadMeses` y `nivelEsperado` siguen en el mensaje como contexto para la IA, no como límite.

No lleva `id_nino`, nombres ni RUT.

- *Alternativa:* que la Lambda pida el contexto a la API. Se descarta porque agrega otra llamada, un endpoint interno más y acopla los tiempos de ambos.

### D4. SQS y Lambda de proceso

- **Cola** `toqui-prod-capturas` (cifrado SQS administrado) y **DLQ** `toqui-prod-capturas-dlq` (retención 14 días), con `maxReceiveCount: 3`.
- **Lambda** `toqui-prod-proceso`: Node 24, ARM64, 1024 MB, `timeout` de 120 s, fuera de la VPC.
- **Visibilidad** de la cola de 720 s (6 veces el `timeout`, como recomienda AWS).
- **Fuente de eventos:** `batchSize: 1`, `reportBatchItemFailures` y `maxConcurrency` configurable (5 por defecto; el mínimo de AWS es 2) para no pasar las cuotas de Bedrock.
- **Último intento:** si `ApproximateReceiveCount` es igual o mayor que 3, la Lambda informa `POST /interno/capturas/:id/error` en vez de lanzar el error. Así la captura nunca queda en `procesando` cuando el mensaje pasa a la DLQ.
- **Pasos en orden:**
  1. normalizar;
  2. anonimizar;
  3. recuperar contexto;
  4. clasificar;
  5. validar;
  6. entregar;
  7. avisar.

  Son pasos lineales de menos de 2 minutos, así que no se usa Step Functions.

- *Alternativa:* conservar Step Functions. Se descarta porque no aporta para pasos lineales y cortos: la cola ya resuelve los reintentos y la concurrencia.

### D5. Normalización y anonimización

- **Texto:** se usa tal cual.
- **Audio:** `StartTranscriptionJob` con `es-US`, sobre `s3://<bucket>/capturas/<id>.<ext>`. El resultado se guarda en el mismo bucket bajo `transcripciones/<id>.json`, con la misma regla de borrado a 7 días. La Lambda consulta `GetTranscriptionJob` cada 3 s, durante un máximo de 90 s. El trabajo se llama `toqui-<id>`: si la cola reintenta, la Lambda retoma el trabajo existente en vez de crear otro. Probado el 15-10-2026 en `ToquiDev` con `nota-sintetica.wav`: 12 s, con un solo error («piló» por «apiló»).
- **Foto:** Amazon Textract (`DetectDocumentText`, síncrono) lee la nota directo desde `s3://<bucket>/capturas/<id>.<ext>`. Las líneas se unen con espacios para que una frase cortada por el renglón se pueda citar entera. Decisión del equipo del 15-10-2026 (Martín): leer la foto con un servicio de OCR y no con el modelo.
  - El límite síncrono de Textract es 10 MB para JPEG y PNG, igual que `TAMANO_MAXIMO_ARCHIVO`, así que la web no necesita reducir la imagen por ese motivo. Un documento rechazado (formato, tamaño o archivo inexistente) se informa como error permanente.
  - **Limitación:** Textract reconoce escritura a mano solo en inglés; en español, solo texto impreso. Probado el 15-10-2026 en `ToquiDev` con fotos sintéticas generadas con tipografías (no con letra real): la impresa y la tipografía Noteworthy salieron exactas, y Bradley Hand cambió algunas «i» por «í». Falta probar con una nota escrita a mano.
  - **Respaldo:** `LECTOR_FOTO=ia` usa el lector de imagen del proveedor de IA (Claude multimodal cuando se integre; hoy `fake`).
  - *Alternativa:* Claude multimodal como lector principal. Se deja como respaldo: cuesta más, consume la cuota de Bedrock y exige reducir la imagen bajo su límite (3,75 MB).
- **Anonimización:** el texto pasa por `ApplyGuardrail` (`toqui-prod-pii`, modo `ANONYMIZE`) **antes** de cualquier otro uso. Si el Guardrail bloquea en vez de anonimizar, la captura pasa a error y el texto original no se usa. El texto anonimizado es el `textoFuente` del borrador, la entrada de los embeddings y de la memoria, y la base de las citas. El texto original de una nota escrita sigue solo en `capturas.texto`, dentro de Aurora.

### D6. Clasificación con Claude y validación

- **Modelo:** `BEDROCK_MODEL_EXTRACCION` (`us.anthropic.claude-sonnet-5-5`), con el Guardrail aplicado también a la salida.
- **El prompt incluye:**
  - el texto anonimizado y la edad en meses;
  - el catálogo permitido del mensaje;
  - hasta 5 fragmentos de la base de conocimiento;
  - hasta 5 ejemplos de la memoria.
- **Salida:** JSON validado con `BorradorEntranteSchema`. La validación comprueba además que cada id esté en el catálogo permitido, que cada cita aparezca en `textoFuente` y que el nivel esté entre 1 y 9.
- **Si la validación falla:** se reintenta una vez indicando el error al modelo. Si vuelve a fallar, el borrador sale con `evidenciaInsuficiente: true`.
- **La API vuelve a validar** al recibir el borrador (`validarBorrador`).
- **Contrato:** se agrega `ejemplosUsados` (entero) al borrador y a la tabla `borradores`.

### D7. Memoria con S3 Vectors, escrita al confirmar

- **Bucket de vectores** `toqui-prod-vectores-<cuenta>`, con el índice `memoria`: 1024 dimensiones, coseno, embeddings de Titan Text Embeddings v2 (`amazon.titan-embed-text-v2:0`).
- **Escribe la API.** Al confirmar o corregir, hace `PutVectors` con:
  - la clave `idCaptura`;
  - los metadatos filtrables `idJardin`, `nivel` y `decision`;
  - los metadatos no filtrables `textoFuente` y `manifestaciones`.

  Se hace después de la transacción, con `try/catch` y un tiempo límite de 3 s: un fallo no afecta la confirmación.
- **Lee la Lambda** con `QueryVectors` (`topK: 5`, filtro `idJardin`).
- **La memoria queda disponible al instante.** En la conversación se habló de agregar la memoria a la Knowledge Base, pero eso depende de un trabajo de ingesta (de 1 minuto o más, uno a la vez por fuente de datos) por cada confirmación. Usar el índice directamente evita esa espera y la orquestación, y sigue siendo S3 Vectors.
- *Alternativa:* pgvector en Aurora. Se descarta porque la Lambda no llega a la base.

### D8. Base de conocimiento con Bedrock Knowledge Base sobre S3 Vectors

- **Componentes:**
  - la KB `toqui-prod-conocimiento`, con embeddings de Titan v2;
  - almacenamiento en el índice `conocimiento` del mismo bucket de vectores;
  - como fuente de datos, el bucket `toqui-prod-conocimiento-<cuenta>`.
- **Documentos.** El script `pnpm aws:prod:kb` reutiliza `leerDataset` de `apps/api/src/seed/dataset.ts` y genera:
  - un documento por manifestación (id, nivel, dominio y texto observable);
  - uno por nivel (rango de edad);
  - uno por dominio.

  Cada documento lleva su `.metadata.json` (`fuente: dataset_e1_publico`, `idManifestacion` y `nivel`). El script los sube con `StartIngestionJob` y espera a que termine.
- **Lectura:** la Lambda usa `Retrieve` con 5 resultados.
- **Lo que se excluye:** la rúbrica institucional de 8 niveles, para no sugerir equivalencias.
- **Valor real:** con 90 manifestaciones, el catálogo completo cabe en el prompt, así que la KB no mejora la precisión por sí sola. Su valor está en escalar a catálogos y documentos más grandes, y se medirá con el acuerdo IA–educadora con y sin contexto.
- *Alternativa:* OpenSearch Serverless. Se descarta porque su costo mínimo es alto para un evento.

### D9. Avisos con AppSync Events

- **API de eventos** `toqui-prod-avisos`, con dos proveedores de autorización: Cognito `toqui-prod`, para conectarse y suscribirse, e IAM, para publicar.
- **Canales:** el espacio de nombres `capturas` tiene un canal por usuaria, `/capturas/<sub>`. Un manejador `onSubscribe` (APPSYNC_JS) rechaza la suscripción si el segmento no coincide con `ctx.identity.sub`.
- **Publicación:** la Lambda publica `{ idCaptura, estado }` con `POST https://<dominio-http>/event`, firmado con SigV4 (`@smithy/signature-v4`).
- **La web** se conecta con `events` de `aws-amplify` y, al recibir un aviso, vuelve a pedir `GET /api/capturas/:id`.
- **Respaldo:** si no hay conexión, o si una captura lleva 10 s en `procesando` sin aviso, la web consulta cada 5 s.
- *Alternativas:* API Gateway WebSocket, que exige guardar las conexiones y más rutas; o *polling* solo, que el equipo descartó porque quiere un aviso.

### D10. Amplify Hosting conectado a GitHub desde la consola, configurado por script

- **App:** la app `dgsos3g6dvh6h` se creó y se conectó a GitHub el 15-10-2026 desde la consola, con la GitHub App de Amplify. Como no la crea CDK, no hace falta un token de GitHub en Secrets Manager. La URL de producción es `https://main.dgsos3g6dvh6h.amplifyapp.com`.
- **Build en código:** `amplify.yml` en la raíz, con `appRoot: apps/web` y Node 24 (`nvm`). Instala con `corepack enable` y `pnpm install --frozen-lockfile --filter @toqui/web`, y compila con `pnpm --filter @toqui/web build`. La web no depende de `@toqui/shared`.
- **Configuración en código:** el script `pnpm aws:prod:amplify` (`infra/scripts/amplify.ts`) lee las salidas de `ToquiApp` y aplica con `UpdateApp` y `UpdateBranch`:
  - las reglas de reescritura;
  - las variables del build (`AMPLIFY_MONOREPO_APP_ROOT=apps/web`, `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID` y `VITE_COGNITO_CLIENT_ID`, más `VITE_AVISOS_HTTP` y `VITE_AVISOS_REALTIME` cuando exista AppSync);
  - el build automático de `main`.

  Conserva las variables definidas a mano en la consola y tiene un modo `--dry-run`. Se vuelve a ejecutar cuando cambian las salidas del stack.
- **Reglas, en este orden:**
  1. `/api/<*>` → `https://<cloudfront>/api/<*>` con estado 200 (proxy). El navegador ve un solo dominio y el código mantiene `baseUrl: '/api'`.
  2. SPA: las rutas sin extensión, o con una extensión que no está en la lista de estáticos, van a `/index.html` con estado 200. La lista incluye `webmanifest`, para no romper la PWA.
- **CloudFront** pasa a ser la entrada de la API: el comportamiento por defecto va al ALB, sin caché, y `/api/*` mantiene la función que quita el prefijo. Se eliminan el bucket web, `BucketDeployment` y la función de rutas SPA.
- **Transición:** primero se verifica Amplify y después se eliminan el bucket web, `BucketDeployment` y la función de rutas SPA. Hasta entonces, la web sigue disponible también por CloudFront.
- **CORS del bucket de capturas:** `ORIGEN_WEB_AMPLIFY` (`https://main.dgsos3g6dvh6h.amplifyapp.com`) más la URL de CloudFront durante la transición, y `localhost:5173` en desarrollo (`ToquiDev`).
- **Plan B**, si el proxy no reenvía `Authorization`: llamar directo a `https://<cloudfront>/api`, habilitar CORS en la API solo para el dominio de Amplify y usar una base URL configurable en orval.
- *Alternativas:* definir la app en CDK (`CfnApp`), que exige un token de GitHub con permisos de administración y recrear la app ya conectada; o mantener S3 + CloudFront, que el equipo descartó porque quiere CI/CD automático de la web.

### D11. Salud de dependencias

`HealthResponse.dependencies` pasa a `{ database, storage, queue }`:

- `storage` se comprueba con `HeadBucket`;
- `queue`, con `GetQueueAttributes`, solo en modo `cola`; en `inline` se informa `up`, porque no aplica;
- cada comprobación tiene un tiempo límite de 2 s.

`pnpm aws:prod:smoke` verifica que las tres estén en `up` vía `/api/health`.

### D12. Permisos mínimos (IAM)

- **Rol de la tarea de la API:**
  - `sqs:SendMessage` y `sqs:GetQueueAttributes` sobre la cola;
  - `s3:GetObject`, `PutObject` y `ListBucket` sobre capturas (ya existe);
  - `bedrock:InvokeModel` sobre `amazon.titan-embed-text-v2:0`;
  - `s3vectors:PutVectors` sobre el índice `memoria`;
  - el secreto `PIPELINE_TOKEN`, inyectado como variable secreta de ECS.
- **Rol de la Lambda:**
  - consumo de la cola (lo otorga la fuente de eventos);
  - `s3:GetObject` en `capturas/*` y `transcripciones/*`, y `s3:PutObject` en `transcripciones/*`;
  - `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob` y `textract:DetectDocumentText` (los tres sin restricción de recurso). Transcribe y Textract leen el archivo, y Transcribe escribe su resultado, con los permisos de la Lambda: por eso necesita los permisos de S3 anteriores;
  - `bedrock:InvokeModel` sobre Claude y Titan, y `bedrock:ApplyGuardrail` sobre el Guardrail;
  - `bedrock:Retrieve` sobre la KB;
  - `s3vectors:QueryVectors` y `GetVectors` sobre `memoria`;
  - `appsync:EventPublish` sobre el espacio de nombres `capturas`;
  - `secretsmanager:GetSecretValue` sobre el token, que la Lambda lee al arrancar y guarda en caché, para que no aparezca en el template. El secreto `toqui/prod/pipeline-token` lo genera CDK (48 caracteres) y la API lo recibe como variable secreta de ECS.
- **Rol de servicio de la KB:** `s3:GetObject` y `ListBucket` sobre el bucket de conocimiento, `bedrock:InvokeModel` sobre Titan, y `s3vectors` de lectura y escritura sobre el índice `conocimiento`.
- **Amplify:** el build no necesita permisos de AWS. Quien ejecuta `pnpm aws:prod:amplify` necesita `amplify:GetApp`, `GetBranch`, `UpdateApp` y `UpdateBranch` sobre la app, y `cloudformation:DescribeStacks` sobre `ToquiApp`.

### D13. Región, costos y limpieza

- **Región:** `us-east-1`.
- **Costo estimado durante el evento, con volumen de demo** (se verifica con la calculadora):
  - SQS y Lambda: centavos;
  - AppSync Events: USD 1 por millón de operaciones más los minutos de conexión;
  - S3 Vectors: centavos por almacenamiento y consultas;
  - Knowledge Base: sin cargo propio, solo embeddings y almacenamiento;
  - Amplify: unos USD 0,01 por minuto de build y USD 0,15 por GB servido;
  - Bedrock, Transcribe y Textract: por uso (Textract cobra por página; una foto es una página).

  Desaparece el costo del bucket web. Aurora, el ALB y Fargate siguen siendo el costo principal.
- **Limpieza:** `pnpm aws:prod:destroy` elimina la cola, la Lambda, AppSync, la KB, el bucket de vectores con sus índices, y el bucket de conocimiento (`autoDeleteObjects`). La app de Amplify `dgsos3g6dvh6h` no está en CDK: se borra a mano desde la consola, y eso retira el webhook de GitHub.

## Risks / Trade-offs

- [La versión de `aws-cdk-lib` no trae `AWS::S3Vectors::*`, la KB con `S3_VECTORS` o `AWS::AppSync::Api` de eventos] → verificarlo primero (tarea 1.1). Si falta, actualizar `aws-cdk-lib` o usar `CfnResource` con el tipo de CloudFormation.
- [No hay acceso a Claude o a Titan v2, o las cuotas son bajas] → comprobarlo antes de programar. Se mantienen `fake` e `inline` como respaldo de la demo, y `maxConcurrency` se ajusta.
- [Alguien cambia las reglas o variables de Amplify en la consola] → `pnpm aws:prod:amplify` reemplaza las reglas y vuelve a fijar las variables que administra. La consola queda solo para ver los builds.
- [El build de Amplify no trae Node 24 o Corepack] → `amplify.yml` instala Node 24 con `nvm`. Si falla, se usa una imagen de build personalizada o `npm i -g pnpm@11.13.0`.
- [El proxy de Amplify no reenvía `Authorization`] → plan B con CORS (D10).
- [El alcance es grande para el plazo] → implementar en orden de valor para la demo:
  1. cola con Lambda para texto con Claude y entrega;
  2. avisos y *polling* de respaldo;
  3. Amplify;
  4. memoria;
  5. base de conocimiento;
  6. audio;
  7. foto.

  Cada grupo de tareas se puede desplegar por separado.
- [Duplicados de SQS] → cuestan una llamada extra a Bedrock, pero no generan datos inconsistentes, gracias a la entrega idempotente (D2 y el borrador único).
- [Transcribe con acento chileno en `es-US`] → probar temprano con el audio sintético del equipo. Si falla, la demo se hace con texto.
- [Textract no reconoce la letra manuscrita en español] → probar con una nota escrita a mano real (sintética, sin datos de personas) antes de la demo. Si la lectura no alcanza, usar `LECTOR_FOTO=ia` cuando Claude esté integrado, o mostrar la foto con una nota impresa.
- [La API todavía no tiene el modo `cola`] → la infraestructura crea la cola y le entrega a la API `SQS_URL_CAPTURAS` y el token, pero la API sigue en `PIPELINE_MODE=aws` hasta la tarea 3.1. Mientras tanto, nada encola trabajos y, sin EventBridge, las capturas de producción quedan en `procesando`: es el mismo resultado que con la Lambda `eco`, que no entregaba borradores.
- [La Lambda llama a la API por el CloudFront público] → el endpoint interno exige `PIPELINE_TOKEN` con comparación en tiempo constante. El token vive solo en Secrets Manager.
- [El texto anonimizado puede perder palabras que no son nombres] → se acepta para la demo, y las citas se validan sobre el mismo texto anonimizado.

## Migration Plan

1. Verificar el acceso a los modelos de Bedrock. La app de Amplify ya está conectada.
2. Mergear a `main` y ejecutar `pnpm aws:prod:deploy`. Esto:
   - actualiza `ToquiApp`: crea SQS, la Lambda, AppSync, los vectores, la KB y Amplify, y elimina EventBridge, Step Functions, `eco` y el bucket web;
   - vuelve a desplegar la API con la migración `encolada_en` / `ejemplos_usados`.
3. Ejecutar `pnpm aws:prod:kb` (ingesta de la base de conocimiento) y `pnpm aws:prod:smoke`.
4. Ejecutar `pnpm aws:prod:amplify` y confirmar que Amplify compiló `main` y que la web abre en `https://main.dgsos3g6dvh6h.amplifyapp.com`.
5. **Reversión:** volver a desplegar el commit anterior, que recrea el pipeline y la web anteriores. Las tablas nuevas no rompen la API anterior, porque sus columnas tienen valores por defecto.

## Open Questions

- El valor final de `maxConcurrency`, según las cuotas de Bedrock que muestre la cuenta. No cambia el diseño.
- Si `es-ES` transcribe mejor que `es-US` un audio con acento chileno. Con el audio sintético (voz de español de México), `es-US` funcionó bien.
- Si Textract alcanza para notas escritas a mano en español (ver D5).
