# Tasks

## 1. API

- [x] 1.1 Migración `borradores.procesamiento` (JSONB) y esquema `Procesamiento` en `packages/shared`; `Borrador.procesamiento` y `BorradorEntrante.procesamiento` opcional
- [x] 1.2 Pipeline inline: `procesamiento` con la entrada y los pasos (`no_implementado` para transcripción y lectura, `simulado` para la extracción)
- [x] 1.3 `AlmacenamientoService.inspeccionar` con `HeadObject`
- [x] 1.4 `POST /capturas/:id/subida`: 409 sin objeto, 422 si no coincide, idempotente; en inline, crear ya no procesa audio ni foto
- [x] 1.5 `CapturaResumen.nivel` (nivel confirmado o null)
- [x] 1.6 Pruebas e2e y `pnpm contract`

## 2. Web

- [x] 2.1 Grabación con `MediaRecorder` y foto con cámara o archivo (conversión a JPEG si hace falta)
- [x] 2.2 Flujo: crear captura, subir a S3, avisar la subida y esperar el borrador
- [x] 2.3 Revisión desde el borrador, con aviso de procesamiento simulado, vista previa del archivo y texto de ejemplo rotulado; confirmar y descartar en la API; quitar «Corregir texto»
- [x] 2.4 «Mis notas», inicio, panel y CSV desde `GET /capturas`; ficha y «Mi sala» solo desde la API; quitar `propuesta.ts`
- [x] 2.5 Pruebas Vitest con MSW (captura, S3, borrador, confirmación)

## 3. Configuración y documentación

- [x] 3.1 README y `.env.example`: `S3_BUCKET_CAPTURAS` y `AWS_PROFILE` para audio y foto en local

## 4. Verificación

- [x] 4.1 Lint, formato, typecheck, pruebas y build
- [x] 4.2 Flujo real de la API contra la base local y el bucket de `ToquiDev`: texto, audio y foto (crear, subir, avisar, borrador con el aviso, descartar)
- [x] 4.3 Recorrer el flujo en el navegador: foto subida a S3 y confirmada desde la web
- [x] 4.5 Integrar `main` (pestañas de escritorio de `vista-nino-escritorio`) con las notas guardadas en la API; pruebas del panel sobre la API falsa
- [x] 4.4 Una sola captura por nota con StrictMode (prueba que falla sin la corrección)

## Workflow follow-up

- Validar con `openspec validate persistir-capturas --strict --no-interactive`.
- Archivar después de `conectar-web-api` y de `vista-nino-escritorio`.
