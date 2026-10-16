## 1. Verificaciones previas

- [ ] 1.1 Instalar dependencias (`pnpm install`) y confirmar que `aws-cdk-lib` 2.273 trae `aws-s3vectors` (`CfnVectorBucket`, `CfnIndex`), la Knowledge Base de `aws-bedrock` con almacenamiento `S3_VECTORS`, `aws-appsync` `CfnApi` y `CfnChannelNamespace` (Events) y `aws-amplify` `CfnApp` y `CfnBranch`. Registrar el resultado en el diseño. Si falta alguno, actualizar `aws-cdk-lib` o usar `CfnResource`, y verificar con `pnpm infra:synth`
- [ ] 1.2 Confirmar en la consola de Bedrock (`us-east-1`) el acceso a `us.anthropic.claude-sonnet-5-5` y a `amazon.titan-embed-text-v2:0`, y anotar las cuotas de peticiones y tokens por minuto. Verificar con una invocación de prueba desde el perfil `toqui`
- [x] 1.3 Conectar la app de Amplify a GitHub. Hecho desde la consola el 15-10-2026: app `dgsos3g6dvh6h`, con la GitHub App y sin token en Secrets Manager

## 2. Contrato compartido

- [ ] 2.1 En `packages/shared`:
  - agregar `MensajeCapturaSchema` (D3) y `ejemplosUsados` a `BorradorEntranteSchema` y `BorradorSchema`;
  - ampliar `HealthResponse.dependencies` a `{ database, storage, queue }`;
  - respuesta del aviso de subida: `CapturaDetalle`, sin esquema propio.

  Verificar con pruebas unitarias de los esquemas, incluido que se rechaza un mensaje con `idNino`
  - Hecho: `MensajeCapturaSchema` (unión por formato, `version: 1`, tipos de archivo por formato) y `AvisoCapturaSchema` en `packages/shared/src/cola.ts`. La Lambda lo valida en cada mensaje.
  - Pendiente: `ejemplosUsados` y las pruebas de los esquemas (incluido el rechazo de `idNino`).
- [ ] 2.2 Agregar la migración Prisma con `capturas.encolada_en` (nullable) y `borradores.ejemplos_usados` (por defecto 0). Verificar con `pnpm db:deploy` en local

## 3. API: despachador, cola y salud

- [x] 3.1 Implementar `Despachador` con las variantes `cola` (SQS `SendMessage`) e `inline` (servicio actual), cambiar `PIPELINE_MODE` a `cola | inline` y exigir `SQS_URL_CAPTURAS` en modo `cola`. Eliminar `guardarTexto`. Actualizar `env.spec.ts` y `.env.example`
- [x] 3.2 Armar el mensaje en la API: edad, nivel esperado y catálogo completo de manifestaciones (decisión del 15-10-2026: sin ventana ±1), sin datos personales. Encolar el texto al crear la captura, y si falla, pasarla a `error` y responder 503. Verificar con una prueba e2e que el mensaje cumple el esquema y no contiene `idNino`
- [x] 3.3 Implementar el aviso de subida (`POST /capturas/:id/subida`, unificado el 15-10-2026 con el de `persistir-capturas`):
  - solo la dueña de la captura;
  - `HeadObject` con el tipo y el tamaño declarados, y 409 si no coinciden;
  - encolado idempotente con `encolada_en`.

  Verificar con pruebas e2e de éxito, 409, repetición (un solo mensaje) y captura ajena (404)
- [x] 3.4 Ampliar `/health` con `storage` (`HeadBucket`) y `queue` (`GetQueueAttributes`), con un tiempo límite de 2 s. Verificar con una prueba en la que la cola falla y el estado queda `degraded`
  - Hecho: `storage` (sin bucket configurado se informa `down`), límite de 2 s para base y bucket, causa del fallo solo en el log, contrato regenerado, `/estado` en la web y paso 3 de `pnpm aws:prod:smoke`. Verificado con `health.e2e.spec.ts` y `almacenamiento.service.spec.ts`.
  - Pendiente: `queue`, junto con 3.1.
- [x] 3.5 Regenerar el contrato (`pnpm contract`) y verificar que `lint`, `typecheck`, `test` y `build` pasan, y que la CI queda en verde

Verificado el 15-10-2026: 56 pruebas de la API (e2e con Postgres en Docker), contrato regenerado, lint, tipos y build. Sin la columna `ejemplos_usados` (2.2), que llega con la memoria.

## 4. Lambda de proceso

- [x] 4.1 Crear en `apps/pipeline` el handler `proceso` para eventos SQS:
  - validar el mensaje con zod;
  - leer y guardar en caché `PIPELINE_TOKEN` desde Secrets Manager;
  - entregar a `/api/interno/capturas/:id/borrador` y `/error`;
  - devolver `batchItemFailures` cuando falla;
  - informar el error en el último intento (`ApproximateReceiveCount >= 3`).

  Verificar con pruebas unitarias con clientes simulados
  - Hecho: `apps/pipeline/src/handlers/proceso.ts` con el orquestador (`orquestador.ts`) y puertos intercambiables (`puertos.ts`). Errores permanentes (se informan de inmediato), transitorios (reintento) y captura cerrada (404/409: se descarta). El aviso es de mejor esfuerzo y la memoria y la base de conocimiento caídas no detienen la clasificación. Verificado con 26 pruebas de vitest.
- [ ] 4.2 Implementar la anonimización con `ApplyGuardrail` y la clasificación con Claude (D6): prompt con el catálogo permitido, salida JSON validada (ids, citas y nivel), un reintento y evidencia insuficiente. Verificar con pruebas unitarias de la validación (id inventado, cita ausente, nivel 10) y con una prueba manual contra Bedrock con una nota sintética
  - Hecho: anonimización con `ApplyGuardrail` (si el Guardrail bloquea, error permanente), verificada en `ToquiDev`: «Sofía Pérez (RUT 12.345.678-5) … a Tomás» → «{NAME} (RUT {rut-chileno}) … a {NAME}». Validación de la respuesta (esquema, catálogo permitido, nivel coherente, citas literales y repetidas), reintento con la corrección y evidencia insuficiente, verificados con pruebas unitarias.
  - Pendiente: el proveedor `bedrock` con Claude (`IA_PROVIDER`, hoy solo `fake`), el Guardrail sobre la salida y la prueba manual contra Bedrock.
  - Nota de implementación: proveedor `bedrock` implementado por `clasificador-bedrock`; falta la prueba manual contra Bedrock y la activación en producción.
- [x] 4.3 Implementar el audio con Transcribe (`es-US`, salida en `transcripciones/`, consultas cada 3 s durante un máximo de 90 s). Verificar con `infra/scripts/fixtures/nota-sintetica.wav` en el ambiente de desarrollo
  - Verificado el 15-10-2026 en `ToquiDev` con el adaptador real: 12 s, transcripción correcta salvo «piló» por «apiló». El trabajo `toqui-<id>` se retoma si la cola reintenta.
- [x] 4.4 Implementar la foto con Amazon Textract (`DetectDocumentText` desde S3, decisión del 15-10-2026 que reemplaza a Claude multimodal; ver D5), con `LECTOR_FOTO=ia` como respaldo. Verificar con una foto sintética de una nota manuscrita
  - Verificado el 15-10-2026 en `ToquiDev` con tres fotos sintéticas generadas con tipografías: impresa y Noteworthy exactas, Bradley Hand con algunas «i» leídas como «í». Orquestación completa (Textract → Guardrail → clasificación `fake`) en 2,5 s.
  - Pendiente: probar con una nota escrita a mano real (Textract solo reconoce manuscrito en inglés).
- [x] 4.5 Eliminar `eco.ts` y su prueba, y actualizar `build.mjs`. Verificar que `pnpm --filter @toqui/pipeline build` genera `proceso.js`
  - `build.mjs` ya empaqueta cada archivo de `src/handlers`: genera `dist/proceso.mjs`.

## 5. Infraestructura de la cola

- [x] 5.1 En `app-stack.ts`:
  - crear la cola, la DLQ y la Lambda `toqui-prod-proceso` con la fuente de eventos (D4);
  - crear el secreto `PIPELINE_TOKEN`, inyectarlo en ECS y dar a la Lambda permiso de lectura;
  - aplicar los permisos de D12;
  - eliminar EventBridge, Step Functions, `PasoEco` y `eventBridgeEnabled`.

  Verificar con `prod-stacks.test.ts` actualizado (la cola tiene DLQ y `maxReceiveCount: 3`, no existe `AWS::StepFunctions::StateMachine` y la API tiene `SQS_URL_CAPTURAS` y `PIPELINE_MODE=cola`)
  - Hecho: cola, DLQ, Lambda `toqui-prod-proceso` (handler `proceso.handler`, log `/toqui/prod/proceso`), secreto `toqui/prod/pipeline-token` en ECS y en la Lambda, permisos de D12 más `textract:DetectDocumentText`, y `SQS_URL_CAPTURAS` con `sqs:SendMessage` para la API. Se eliminaron EventBridge, Step Functions, `PasoEco` y `eventBridge` del bucket. `pnpm aws:prod:smoke` (paso 5) encola un trabajo sintético y verifica en el log que la Lambda llega a la API interna. Verificado con `prod-stacks.test.ts` (13 pruebas) y `typecheck`; sin desplegar.
  - Pendiente: `PIPELINE_MODE=cola` en la API, junto con 3.1 (hoy la API solo acepta `aws | inline`).
- [ ] 5.2 Desplegar `ToquiApp` con aviso al equipo y ampliar `pnpm aws:prod:smoke`: `/api/health` con las tres dependencias en `up`, y una nota de texto sintética creada con un usuario de prueba que llega a `borrador_listo` en menos de 60 s. Verificar que el smoke pasa
- [ ] 5.3 Actualizar `docs/arquitectura-aws.md` (diagrama, servicios y permisos) y el README con el flujo nuevo y los comandos verificados

## 6. Avisos a la web

- [ ] 6.1 Crear en CDK la API de AppSync Events `toqui-prod-avisos` (Cognito e IAM), el espacio de nombres `capturas` con un `onSubscribe` que exige que el canal coincida con `ctx.identity.sub`, y los permisos de publicación para la Lambda. Verificar con una prueba de CDK
- [ ] 6.2 Publicar `{ idCaptura, estado }` desde la Lambda al entregar el borrador o el error, firmando con SigV4. Verificar con una prueba unitaria que el aviso no incluye texto ni manifestaciones
- [ ] 6.3 En `apps/web`, agregar un cliente de avisos (`aws-amplify` `events`) que se suscribe a `/capturas/<sub>`, vuelve a pedir `GET /api/capturas/:id` al recibir un aviso y consulta cada 5 s si una captura lleva 10 s sin aviso. Verificar con pruebas de componente (aviso recibido; *polling* sin conexión)
- [ ] 6.4 Verificar en el ambiente desplegado que la propuesta aparece sin recargar, y que una suscripción a un canal ajeno es rechazada

## 7. Web en Amplify

- [x] 7.1 Agregar `amplify.yml` en la raíz (monorepo, `appRoot: apps/web`, Node 24 con `nvm`, pnpm con Corepack e instalación filtrada a `@toqui/web`). Verificado en local con `pnpm --filter @toqui/web build`. Falta confirmar en el primer build de Amplify (7.3)
- [x] 7.2 Crear `pnpm aws:prod:amplify` (`infra/scripts/amplify.ts`) con las reglas de proxy `/api` y de SPA (incluido `webmanifest`), las variables `VITE_*` y del monorepo, el build automático de `main` y `--dry-run`. Agregar `ORIGEN_WEB_AMPLIFY` al CORS del bucket de capturas. Verificado con `typecheck` y `test` de infra (prueba nueva de CORS)
- [ ] 7.3 Desplegar `ToquiApp` (CORS), ejecutar `pnpm aws:prod:amplify --dry-run` y luego sin `--dry-run`, hacer push a `main` y verificar que:
  - el build de Amplify termina bien;
  - `/api/health` responde por `https://main.dgsos3g6dvh6h.amplifyapp.com`;
  - `/api/me` con token funciona (`Authorization` reenviado);
  - recargar una ruta interna no da 404;
  - `manifest.webmanifest` se sirve como archivo;
  - una subida firmada desde la web no da error de CORS.

  Si `Authorization` no pasa, aplicar el plan B de D10
- [ ] 7.4 Con 7.3 en verde: cambiar el comportamiento por defecto de CloudFront al ALB, eliminar el bucket web, `BucketDeployment` y la función de rutas SPA, quitar la URL de CloudFront del CORS y quitar el build de la web de `pnpm aws:prod:deploy`. Verificar con una prueba de CDK y con `pnpm aws:prod:smoke`, ajustado para que revise la web en Amplify
  - Implementado en código por `endurecer-seguridad-aws` (tareas 1.1 y 1.2), con CloudFront hacia un ALB interno por VPC Origin. Pendiente: desplegar y verificar con `pnpm aws:prod:smoke`.
- [ ] 7.5 Documentar en el README y en `docs/arquitectura-aws.md` la URL, el flujo de publicación (push a `main`) y `pnpm aws:prod:amplify` una vez verificado

## 8. Memoria y base de conocimiento

- [ ] 8.1 Crear en CDK el bucket de vectores con los índices `memoria` y `conocimiento`, el bucket de conocimiento, la KB `toqui-prod-conocimiento` con su fuente de datos y su rol, y los permisos de D12. Verificar con una prueba de CDK
- [ ] 8.2 En la API, escribir la memoria al confirmar o corregir (embedding de Titan v2 y `PutVectors`), con un tiempo límite y sin afectar la confirmación. Verificar con pruebas e2e: confirmación con la memoria fallando responde 200; un descarte no escribe
- [ ] 8.3 En la Lambda, consultar `QueryVectors` (`topK: 5`, filtro `idJardin`) y `Retrieve` (5 fragmentos), incluir ambos en el prompt e informar `ejemplosUsados`. Si fallan, seguir sin contexto. Verificar con pruebas unitarias (otro jardín da 0; KB caída igual entrega el borrador)
- [ ] 8.4 Crear `pnpm aws:prod:kb`: genera los documentos desde `DATASET_DIR` con su procedencia y sin la rúbrica, los sube y ejecuta la ingesta. Verificar que una `Retrieve` de prueba devuelve manifestaciones del dataset, y documentar el comando en el README

## 9. Integración y documentación

- [ ] 9.1 Prueba de punta a punta en producción con un usuario sintético: una nota de texto y un audio llegan a la propuesta con aviso; confirmar y luego registrar una nota parecida muestra `ejemplosUsados > 0`. Registrar los tiempos de `eventos_tiempo`
- [ ] 9.2 Actualizar en `definir-mvp-e1/design.md` las decisiones D2, D6 y D10 y las tareas 7.x para que apunten a este cambio. Verificar con `openspec validate definir-mvp-e1 --strict --no-interactive`
- [ ] 9.3 Validar con `openspec validate cola-ia-y-amplify --strict --no-interactive`

## Workflow follow-up

- Sincronizar especificaciones y archivar este cambio al completar el trabajo, después de archivar `levantar-arquitectura-aws`.
- Al terminar la hackatón: `pnpm aws:prod:destroy` y borrar desde la consola la app de Amplify `dgsos3g6dvh6h`.
