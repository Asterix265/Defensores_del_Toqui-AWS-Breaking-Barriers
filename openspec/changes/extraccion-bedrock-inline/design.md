# Design

## Context

En `main`, `PipelineInlineService` arma el borrador con funciones `fake` locales (`ia-fake.ts`) y declara en `procesamiento` qué es simulado. La rama cerrada `feat/pipeline-ia` (PR #10) ya tenía un módulo `packages/ia` probado contra Bedrock, pero mezclaba ese módulo con las Lambdas, Step Functions e infraestructura en un solo PR. Este cambio rescata solo el módulo y el modo inline.

## Decisions

### 1. `packages/ia` independiente del runtime
Exporta `IaProvider` (`extraer(texto, contexto)`), `ProveedorFake`, `ProveedorBedrock` (`anonimizar`, `extraer`, `describirFoto`), el prompt y `validarPropuesta`. Su contexto (`ContextoExtraccion`: edad, nivel esperado y catálogo) se define en el propio paquete, sin depender de un contrato del endpoint interno que aún no existe. Las Lambdas lo usarán sin cambios.

### 2. Extracción: Guardrail → Claude → zod
`ApplyGuardrail` (fuente `INPUT`) anonimiza antes de llamar al modelo y el texto anonimizado es el `textoFuente` guardado. Claude responde con la herramienta `registrar_borrador`. La validación comprueba que los IDs estén en el catálogo, que haya un solo nivel y que las citas aparezcan en el texto, tolerando mayúsculas, espacios y comillas y guardando el fragmento literal. Si falla, reintenta una vez con los problemas como `toolResult`; si vuelve a fallar, devuelve evidencia insuficiente. El catálogo es el de los niveles esperado ±1 (D7). El proveedor `fake` sigue usando solo el nivel esperado.

### 3. Foto: transcribir el post-it
`describirFoto` pide transcribir literalmente lo escrito y marcar `[ilegible]` lo que no se lee. Si no hay texto, describe la actividad sin nombres ni rasgos físicos; si no hay nada, responde `(sin texto reconocible)`, que lleva a evidencia insuficiente. La lectura pasa después por el Guardrail igual que una nota escrita. La API descarga el objeto de S3 (`GetObject`) solo en modo inline. En AWS lo hará la Lambda.

### 4. Audio sin cambios
Transcribe es un trabajo asíncrono de segundos a minutos. Esperarlo dentro de la API contradice la regla stateless y le corresponde a Step Functions (D6), así que en inline el audio conserva el texto de ejemplo y el paso `transcripcion: no_implementado`.

### 5. `procesamiento` según lo ocurrido
Los pasos se construyen en `procesamiento.ts` a medida que el pipeline los ejecuta. `simulado` es `true` si algún paso no está `completado`. La web decide el rótulo del texto con los pasos (`transcripcion` o `lectura_imagen` en `completado`), no con el proveedor.

### 6. Límite de 3,75 MB para la foto
Converse acepta imágenes de hasta 3,75 MB. Si la foto supera ese tamaño, `prepararFoto` la redibuja como JPEG con un lado máximo de 2000 px, en vez de agregar `sharp` a la API.

## Risks

- Costo y latencia de Bedrock en cada nota (2 a 3 llamadas). Con datos sintéticos y uso de demo, el costo es bajo; `fake` sigue siendo el valor por defecto.
- Si Bedrock falla, la nota queda en `error` con «No se pudo procesar la nota» y la educadora elige a mano, como ya permite la API.
- Una foto con datos reales llegaría a Bedrock. Solo se usan post-its sintéticos, y el Guardrail se aplica al texto leído, no a la imagen.
