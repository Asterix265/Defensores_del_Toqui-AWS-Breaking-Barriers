## 1. Base del monorepo

- [x] 1.1 Base técnica (monorepo, Node 24, lint, Docker Compose, `.env.example`, scripts multiplataforma, CI, Dockerfile de la API, contrato zod → OpenAPI → orval y validación de configuración) cubierta por el cambio `levantar-stack-base`
- [x] 1.2 Agregar a `.env.example` y a la validación zod las variables del MVP: `DATASET_DIR`, `IA_PROVIDER`, `AUTH_MODE`, `PIPELINE_MODE`

## 2. Contrato y datos (imprescindible)

- [x] 2.1 Crear `packages/shared` con esquemas zod: `Nino`, `Manifestacion`, `Captura`, `Borrador`, `ObservacionConfirmada`, `Correccion`, `Trayectoria`, `MetricasImpacto`
- [x] 2.2 Reemplazar la tabla técnica `_salud` de `apps/api` por el esquema de tablas del dataset más `captura`, `borrador`, `observacion` (origen, `id_captura`, citas), `correccion` y `evento_tiempo`; generar la migración inicial
- [x] 2.3 Implementar `scripts/seed` que lea `DATASET_DIR`, valide los CSV y cargue los datos; verificar los conteos 20/80/500/9/90/2.950/8.850 y el error ante una ruta inválida

## 3. Autenticación (debería; el modo local es imprescindible)

- [x] 3.1 Implementar un *guard* global con `AUTH_MODE=local` (usuario fijo de `JAR-0001`) que bloquee el arranque fuera del entorno local
- [x] 3.2 Implementar validación de JWT de Cognito con `aws-jwt-verify`, grupos `educadora`/`directora` y filtro por `custom:id_jardin`; pruebas de 401 y 403
- [ ] 3.3 Integrar `Authenticator` de Amplify UI en `apps/web` según `AUTH_MODE`

## 4. Captura y pipeline de IA (imprescindible)

- [x] 4.1 Implementar en la API la creación de captura y la URL prefirmada de subida a S3 (en local, almacenamiento en disco del contenedor de desarrollo o MinIO, según se decida en la tarea)
- [x] 4.2 Definir la interfaz `IaProvider` e implementar `fake` con borradores deterministas válidos
- [x] 4.3 Implementar el paso de extracción: selección del catálogo por edad (nivel esperado ±1), prompt, salida JSON y validación zod (IDs existentes, citas presentes en el texto, nivel 1–9, coherencia de nivel); reintento y evidencia insuficiente
- [x] 4.4 Implementar `IaProvider` `bedrock` con Claude y Guardrails (filtro de información personal); comprobar que la solicitud no incluye `id_nino` ni nombres
- [x] 4.5 Implementar la normalización de audio con Transcribe (`es-US`) y probarla con un audio sintético grabado por el equipo
- [x] 4.6 Implementar `PIPELINE_MODE=inline` (pasos secuenciales en la API) y el endpoint interno que recibe borradores de forma idempotente por `id_captura`
- [ ] 4.7 (Debería) Implementar la normalización de foto con Claude multimodal y reducción de tamaño con `sharp`

## 5. Revisión, trayectoria y panel (imprescindible y debería)

- [ ] 5.1 Pantalla de captura móvil: elegir niño o niña, escribir, grabar audio y tomar foto, con estado `procesando`
- [ ] 5.2 Pantalla de revisión: manifestaciones con cita, nivel rotulado como estimación pedagógica, agregar o quitar manifestaciones del catálogo, confirmar o descartar; guardar la corrección
- [ ] 5.3 Endpoint y vista de trayectoria por niño o niña y dominio, con «sin registros en el periodo» y aviso de evidencia limitada
- [ ] 5.4 (Debería) Panel del grupo con huecos de evidencia de 30 días
- [ ] 5.5 (Debería) Resumen del grupo con Claude citando IDs de observación, en lenguaje no diagnóstico

## 6. Medición de impacto (debería)

- [x] 6.1 Registrar eventos de tiempo (inicio, borrador listo, confirmación) por captura
- [ ] 6.2 Calcular acuerdo exacto, ±1 y de manifestaciones, total y por dominio; panel de impacto con método, supuestos y línea base rotulada
- [ ] 6.3 (Si sobra tiempo) Conjunto de evaluación sintético desde el dataset y comando `pnpm eval` con precisión, exhaustividad y acuerdo

## 7. Infraestructura AWS (debería; requiere confirmación antes de desplegar)

- [ ] 7.1 Documentar los permisos IAM necesarios (desarrollo: Bedrock, Transcribe, S3 y tabla o base de desarrollo; despliegue: CDK) y solicitar acceso a modelos en Bedrock
- [ ] 7.2 Reemplazar el stack de marcador de `infra` por los stacks `datos`, `almacenamiento`, `auth`, `pipeline`, `api` y `web` con mínimo privilegio; `cdk synth` sin errores
- [x] 7.4 Implementar Step Functions con las Lambdas del pipeline e idempotencia por nombre de ejecución
- [ ] 7.5 Desplegar con confirmación del equipo, ejecutar migraciones, cargar datos, crear usuarios de demo y probar el flujo completo
- [ ] 7.6 Documentar región, costos estimados y limpieza (`cdk destroy`) en el README

## 8. Opcionales

- [ ] 8.1 Video con Amazon Nova o Bedrock Data Automation (o ffmpeg con fotogramas y Transcribe) hacia el mismo paso de extracción
- [ ] 8.2 Embeddings en pgvector y ejemplos de correcciones similares del mismo jardín en el prompt, indicando cuántos se usaron
- [ ] 8.3 Prueba de carga con k6 mostrando el autoescalado de Fargate

## 9. Documentación y demo

- [ ] 9.1 Actualizar el README con los comandos verificados, la ubicación del dataset (`DATASET_DIR`) y el estado real del proyecto
- [ ] 9.2 Producir y documentar audios y fotos sintéticos de la demo (sin niños o niñas reales)
- [ ] 9.3 Guion de demo y pitch alineado a los criterios de evaluación; ensayo con el proveedor `fake` como respaldo
- [ ] 9.4 Validar con `openspec validate definir-mvp-e1 --strict --no-interactive` y sincronizar especificaciones al completar

## Notas de implementación (15-10-2026, rama `feat/api-lambda`)

- 2.1: los esquemas están en `packages/shared/src/registro.ts` con los nombres del contrato HTTP (`CapturaDetalle`, `Borrador`, `ObservacionConfirmada`, `ConfirmacionRequest`, `TrayectoriaResponse`, `MeResponse`); `Correccion` y `MetricasImpacto` no se exponen todavía.
- 2.3: la carga vive en `apps/api/src/seed` y se ejecuta con `pnpm db:seed` (compila la API). Verificada con el dataset público: 20/80/500/9/90/2.950/8.850. Genera nombres sintéticos para niños, niñas y educadoras.
- 4.1: en local se usa el bucket de `ToquiDev` (`S3_BUCKET_CAPTURAS`), no disco ni MinIO.
- 4.2 y 4.6: el proveedor `fake` y el modo inline están en la API (`apps/api/src/pipeline`); la interfaz `IaProvider` del pipeline de Lambdas queda para 4.3–4.5.
- 5.3: la API ya expone `GET /ninos/:id/trayectoria`; falta la vista.

## Notas de implementación (15-10-2026, rama `feat/pipeline-ia`)

- Módulo compartido `packages/ia` (decisión del equipo tras comparar IA en Nest frente a Lambda): `IaProvider` con `fake` y `bedrock`, prompt, validación zod y reintento. Lo usan las Lambdas y el modo inline de la API (`IA_PROVIDER=bedrock` en inline procesa texto real; audio y foto siguen simulados).
- 4.3: el catálogo de niveles esperado ±1 lo arma la API en `GET /interno/capturas/:id/contexto` (las Lambdas no tocan la base). La salida estructurada usa una herramienta de Converse con `toolChoice: auto`: Sonnet 5.5 rechaza forzar la herramienta. Las citas se ubican tolerando mayúsculas, espacios y comillas, y siempre se guardan como fragmento literal.
- 4.4: `ApplyGuardrail` anonimiza el texto antes del modelo y el borrador cita sobre el texto anonimizado (`{NAME}`); el contexto no incluye `id_nino` ni nombres. Probado en vivo con el Guardrail de `ToquiDev`.
- 4.5: Transcribe se invoca con la integración nativa de Step Functions (espera de 5 s entre consultas) y escribe en `transcripciones/`. La prueba usa el audio sintético `infra/scripts/fixtures/nota-sintetica.wav`; falta un audio grabado por el equipo.
- 4.7: la lectura de fotos con Claude multimodal está implementada (`describir-foto`), pero sin `sharp`: se rechazan fotos de más de 3,75 MB. Queda abierta hasta reducir el tamaño en el navegador o agregar `sharp`.
- 7.4: el nombre de ejecución no es el `id_captura` (EventBridge no permite fijarlo); la idempotencia la da la API (un borrador por captura) y `preparar`, que omite capturas ya decididas.
- 7.5: la carga de Aurora usa una tarea puntual de ECS (`pnpm aws:prod:seed`, `TAREA=seed` y `DATASET_DIR=s3://…`).

