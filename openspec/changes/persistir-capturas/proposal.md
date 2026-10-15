# Proposal

## Why

La web ya muestra datos reales del jardín (`conectar-web-api`), pero la acción principal de la plataforma, registrar una nota y guardar la decisión de la educadora, no llega a la base: las notas viven en memoria y se pierden al recargar. Además, audio y foto se simulan sin usar el micrófono ni la cámara. La API ya tiene el flujo de capturas (crear → borrador → confirmar o descartar), la base local y un bucket S3 de desarrollo (`ToquiDev`) con CORS para `localhost:5173`.

## What Changes

- La web registra **texto, audio y foto de verdad**: graba con el micrófono (`MediaRecorder`), toma o elige la foto, y sube audio y foto directo a S3 con la URL firmada que entrega `POST /capturas`.
- **Persistencia**: cada nota se crea con `POST /capturas`, la revisión muestra el borrador que genera la API y la educadora confirma (`POST /capturas/:id/confirmacion`) o descarta (`POST /capturas/:id/descarte`). La observación y la corrección (sugerencia frente a decisión) quedan en la base.
- **Nuevo `POST /capturas/:id/subida`**: la web avisa que el archivo ya está en S3; la API lo comprueba (tipo y tamaño) y recién entonces procesa en modo `inline`. Hoy el modo `inline` procesa al crear, sin esperar el archivo. En modo `aws` no hace nada, porque el pipeline lo dispara EventBridge.
- **El borrador declara qué se procesó** (campo `procesamiento`): la entrada (formato, tipo, tamaño, clave S3) y el estado de cada paso. Mientras no existan Transcribe ni la lectura de imágenes, la transcripción y la lectura figuran como **no implementadas** y usan un **texto de ejemplo**; la extracción figura como **simulada** (IA `fake`). La revisión lo muestra en un aviso visible, junto con el audio o la foto.
- «Mis notas», el panel de escritorio y el contador del inicio leen de `GET /capturas`; la ficha y «Mi sala» muestran las observaciones confirmadas en la app por la trayectoria. Se elimina la propuesta simulada de la web (`propuesta.ts`).
- `CapturaResumen` agrega el nivel confirmado, para el reporte CSV.

**Supuestos**: en local se usa el bucket de `ToquiDev` con el perfil AWS `toqui`; el bucket borra los objetos a los 7 días, así que después de eso el original ya no se puede ver, aunque la nota sigue en la base. Solo se graban audios y fotos sintéticos (sin niños ni niñas reales). El micrófono y la cámara requieren `localhost` o HTTPS.

**Exclusiones**: Transcribe, lectura de imágenes con Claude y Bedrock (siguen pendientes en `definir-mvp-e1`); retomar desde «Mis notas» una nota que quedó sin revisar; corregir el texto de la nota (la confirmación de la API no lo recibe, así que se quita «Corregir texto»).

## Capabilities

### New Capabilities

- `captura-y-persistencia`: registro de texto, audio y foto desde la web, subida a S3, procesamiento con aviso de lo simulado y persistencia de la decisión de la educadora.

### Modified Capabilities

- `registro-web-api` (de `conectar-web-api`): la propuesta deja de calcularse en la web y viene del borrador de la API.

## Impact

- API: migración `borradores.procesamiento`, esquemas `Procesamiento` y `CapturaResumen.nivel`, `POST /capturas/:id/subida`, inspección del objeto en S3, pipeline inline con pasos declarados. Contrato y cliente orval regenerados.
- Web: grabación y foto reales, subida a S3, flujo de captura con la API, revisión con aviso de procesamiento simulado, listas desde la API.
- Configuración local: `S3_BUCKET_CAPTURAS` (salida `BucketCapturas` de `ToquiDev`, con `pnpm aws:env`) y `AWS_PROFILE=toqui` en `apps/api/.env`.
- Debe archivarse después de `conectar-web-api`.
