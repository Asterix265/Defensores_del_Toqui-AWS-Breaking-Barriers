## Context

- Decisión del equipo (15-10-2026, ADR «¿IA en Nest o en Lambda?»): la IA vive en un módulo puro, `packages/ia`, que depende de **Lambda** solo como entorno de ejecución. Nest **no** lo llama por ahora; si sobra tiempo se puede reintroducir como respaldo de la demo (`PIPELINE_MODE=inline` + `IA_PROVIDER=bedrock`), pero no forma parte de este cambio.
- Hay **una sola Lambda de proceso** (`toqui-prod-proceso`, `apps/pipeline`), activada por la cola SQS (cambio `cola-ia-y-amplify`, que reemplazó a Step Functions). El mensaje de la cola ya trae la edad, el nivel esperado y el catálogo completo, así que la Lambda no pide el contexto a la API. Normaliza (Transcribe para audio, Textract para foto), anonimiza con el Guardrail, clasifica, valida y entrega en `POST /interno/capturas/:id/borrador`. El módulo nunca ve audio.
- Estado de `main` (commit `2dad05d`): no existe `packages/ia`. `apps/pipeline` ya tiene el orquestador de la Lambda `proceso` (puertos `Clasificador`, `LectorImagen` y `Anonimizador`, validación `validarClasificacion` y un reintento) y solo el clasificador `fake`; el orquestador guarda como `textoFuente` el texto anonimizado (D5 de `cola-ia-y-amplify`). `packages/shared/src/registro.ts` define `BorradorEntrante` (`textoFuente`, `nivelSugerido` 1..9 o `null`, `evidenciaInsuficiente`, `manifestaciones[{idManifestacion, cita}]` con máximo 5, `proveedor`, `modelo?`), `Manifestacion` (`id`, `nivel`, `dominio`, `textoObservable`) y `Dominio` (enum de 5 valores). `infra/lib/componentes.ts#crearGuardrail` anonimiza `NAME`, `EMAIL`, `PHONE`, `ADDRESS` y RUT; Bedrock reemplaza lo detectado por marcadores como `{NAME}`.
- Dataset: ruta de 9 niveles y 5 dominios (90 manifestaciones; ids como `MAN-L01-CO-01`). La presentación del desafío y la FAQ de Integra hablan de 8 o 9 niveles por núcleo y de 8 a 10 núcleos. `AGENTS.md` prohíbe asumir equivalencias entre ambas rúbricas: este módulo **no** las mapea, solo trabaja con el catálogo que recibe.
- Restricciones: Node 24, ESM (`"type": "module"`), TypeScript estricto (`tsconfig.base.json`), pnpm con catálogo (`zod`, `typescript`, `vitest` como `catalog:`), runtime Lambda `nodejs24.x` que ya incluye AWS SDK v3, región `us-east-1`, modelo `us.anthropic.claude-sonnet-5-5`. Equipo en Windows, macOS y Linux: nada específico de un sistema operativo.
- Plazo: cierre de código el 16-10-2026 a las 10:15. Lo imprescindible es `extraer` con `fake` y `bedrock`; la foto es «debería».

## Goals / Non-Goals

**Goals:**

- Un paquete `@toqui/ia` que la Lambda pueda importar sin arrastrar Nest, Prisma ni clientes de S3 o de la API.
- Contrato pequeño y estable que el pipeline pueda usar desde el primer día con el proveedor `fake`.
- Salida siempre válida según `BorradorEntranteSchema`: IDs del catálogo, citas literales del texto original, un solo nivel, entre 1 y 5 manifestaciones, o evidencia insuficiente.
- Rúbrica parametrizable: ningún número de niveles ni nombre de núcleo escrito en el código del módulo.
- Datos personales protegidos: Guardrail antes de Claude, falla cerrada, texto original persistido.
- Pruebas que corran sin AWS en CI.

**Non-Goals:**

- Leer S3, llamar a la API interna, invocar Transcribe o Textract o decidir el flujo (`apps/pipeline`).
- Un endpoint de contexto: el mensaje de la cola ya trae edad, nivel esperado y catálogo.
- Tocar `apps/api`, `apps/pipeline`, `infra` o `packages/shared`. En particular, no abrir `Dominio` ni `NivelSchema` en `shared`.
- Equivalencia entre rúbricas de 8 y 9 niveles; diagnóstico; confianza numérica; aprendizaje por correcciones; resumen del grupo (Haiku).

## Decisions

### D1. Paquete `packages/ia` espejo de `packages/shared`

Mismo formato que `packages/shared`: `"type": "module"`, `main`/`types`/`exports` apuntando a `dist/`, scripts `build` (`tsc -p tsconfig.build.json`), `typecheck` y `test` (`vitest run`), `tsconfig.json` con `module`/`moduleResolution` `NodeNext` y `tsconfig.build.json` con `declaration: true` que excluye `*.test.ts`. Imports internos con extensión `.js`. Dependencias: `@toqui/shared` (`workspace:*`, verificar el especificador que usa `apps/api/package.json`), `zod` (`catalog:`) y `@aws-sdk/client-bedrock-runtime` (versión estable reciente). `typescript` y `vitest` como `catalog:` en dev. `private: true`.

- *Alternativa:* `apps/pipeline/src/pasos` (el ADR la permite). Se descarta: un paquete aparte deja explícito que no depende de Lambda y permite reutilizarlo desde Nest más adelante sin mover código.

### D2. Contrato público

Todo se exporta desde `src/index.ts`. Tipos en español, nombres técnicos conservados.

```ts
import type { BorradorEntrante } from '@toqui/shared';

/** Estructuralmente compatible con `Manifestacion` de shared, pero con `dominio` abierto. */
export interface ManifestacionCatalogo {
  id: string;
  nivel: number;
  dominio: string;
  textoObservable: string;
}

export interface ContextoExtraccion {
  edadMeses: number;
  nivelEsperado: number;
  /** Lo decide el llamador (en el pipeline, el catálogo completo del mensaje). Define los niveles y núcleos válidos. */
  catalogo: ManifestacionCatalogo[];
}

export type FormatoImagen = 'jpeg' | 'png';

export interface IaProvider {
  readonly nombre: 'fake' | 'bedrock';
  extraer(texto: string, contexto: ContextoExtraccion): Promise<BorradorEntrante>;
  normalizarFoto(imagen: Uint8Array, formato: FormatoImagen): Promise<string>;
}

export type ConfigIa =
  | { proveedor: 'fake' }
  | {
      proveedor: 'bedrock';
      modelo: string;
      region?: string;
      guardrail?: { id: string; version: string };
      /** Solo desarrollo local: permite Bedrock sin Guardrail. Por defecto el Guardrail es obligatorio. */
      sinGuardrail?: boolean;
      /** Inyectable para pruebas. */
      cliente?: Pick<BedrockRuntimeClient, 'send'>;
    };

export function crearProveedor(config: ConfigIa): IaProvider;

export function validar(
  propuesta: unknown,
  texto: string,
  contexto: ContextoExtraccion,
  opciones?: { maxManifestaciones?: number },
): ResultadoValidacion;

export function normalizarTexto(texto: string): string;
export function textoDeTranscripcion(json: string): string;

export class ErrorIa extends Error {
  readonly codigo: CodigoErrorIa; // 'FOTO_NO_VALIDA' | 'GUARDRAIL_NO_DISPONIBLE' | 'CONFIGURACION_INVALIDA'
}
```

`ResultadoValidacion` = `{ ok: true; borrador: Omit<BorradorEntrante, 'proveedor' | 'modelo'> } | { ok: false; problemas: string[] }`. `maxManifestaciones` vale 5 por defecto (el límite de `BorradorEntranteSchema`) y nunca puede superarlo.

`ManifestacionCatalogo` es propio del módulo para no depender del enum cerrado `Dominio`; un `Manifestacion[]` de `shared` es asignable a él sin conversión. El valor de retorno sigue siendo el tipo de `shared`, así que la API lo acepta sin cambios.

- *Alternativa:* una función `procesarCaptura` de alto nivel. Se descarta: obligaría al módulo a conocer formatos, S3 y estados, y movería lógica de orquestación fuera de la Lambda.

### D3. Rúbrica derivada del catálogo

Ninguna constante `9`, `8`, `5 dominios` ni lista de dominios en el código del módulo (salvo el tope de 5 manifestaciones del contrato). Los niveles válidos son el conjunto de `nivel` presentes en `catalogo`; los núcleos o dominios son los valores de `dominio` presentes. El prompt agrupa por nivel y muestra el dominio de cada manifestación tal cual viene. Con 8 niveles × 10 núcleos o 9 niveles × 5 dominios el comportamiento es el mismo.

Limitación conocida: el valor devuelto sigue siendo `BorradorEntrante`, cuyo `nivelSugerido` está acotado a 1..9 por `NivelSchema` en `shared`. Una rúbrica con más de 9 niveles exige ampliar `shared`, fuera de este cambio.

### D4. Flujo de `extraer` en `bedrock`

1. `texto = normalizarTexto(texto)`. Si tiene menos de `MINIMO_TEXTO` (20) caracteres, devolver evidencia insuficiente **sin llamar a Guardrail ni a Claude**.
2. Aplicar el Guardrail (`ApplyGuardrailCommand`, `source: 'INPUT'`) sobre el texto. Resultado: `textoAnonimo`.
3. Llamar a Claude con `ConverseCommand`: `system` fijo; un único mensaje de usuario con edad en meses, nivel esperado, catálogo agrupado por nivel y la nota anonimizada entre delimitadores; herramienta `registrar_borrador` con `inputSchema` JSON (`evidenciaInsuficiente`, `nivel`, `manifestaciones[{idManifestacion, cita}]`); `inferenceConfig.maxTokens` ≈ 1500.
4. Validar la propuesta con `validar` contra `textoAnonimo` y el catálogo.
5. Si no es válida, **un** reintento enviando de vuelta los problemas como `toolResult` con `status: 'error'` (o texto si no hubo `toolUse`). Si vuelve a fallar, o la respuesta no trae contenido, devolver evidencia insuficiente.
6. Mapear las citas de `textoAnonimo` al texto original (D5) y devolver `{ textoFuente: textoOriginal, ..., proveedor: 'bedrock', modelo }`.

El mensaje enviado al modelo **nunca** incluye `id_captura`, `id_nino`, nombres, RUT ni otros identificadores: el módulo no los recibe, y una prueba lo verifica inspeccionando el comando enviado. La nota va entre etiquetas `<nota>…</nota>`; si el texto ya contiene una etiqueta con ese nombre (por ejemplo `</nota>` seguido de instrucciones) se usa `nota-1`, `nota-2`… hasta que no aparezca, para que el texto no pueda cerrar el bloque.

`toolChoice`: usar `{ auto: {} }` mientras no se confirme que el modelo acepta forzar la herramienta (ver Open Questions); si no se llama a la herramienta, cuenta como respuesta inválida y entra al reintento.

- *Alternativa:* pedir JSON libre en texto. Se descarta: menos fiable que la salida por herramienta y sin esquema.

### D5. Texto original persistido y citas mapeadas

`BorradorEntrante.textoFuente` es lo que la API guarda y lo que la educadora revisa; mostrar `{NAME}` en vez del nombre real degrada la revisión, y en audio no existiría otra copia. Por eso el texto devuelto es el **original normalizado**, y las citas deben aparecer literalmente en él: la API lo verifica al recibir el borrador (`CapturasService.validarBorrador` rechaza una cita que no esté en `textoFuente`), así que una cita con marcadores como `{NAME}` haría fallar la entrega.

Como Claude solo ve `textoAnonimo`, sus citas pueden contener marcadores (`{NAME}`, `{EMAIL}`, `{PHONE}`, `{ADDRESS}`, `{rut-chileno}`; patrón `\{[A-Za-z0-9_-]+\}`). `mapearCita(cita, textoAnonimo, textoOriginal)` convierte la cita en una expresión regular escapando el texto literal y sustituyendo cada marcador por `.+?` (perezoso, insensible a mayúsculas y a espacios repetidos) y devuelve el **fragmento tal cual está en el original**. Si no hay coincidencia, la cita se considera no localizada y cuenta como problema del intento (reintento o evidencia insuficiente).

`ubicarCita` (usado por `validar`) conserva la tolerancia a mayúsculas, espacios repetidos y comillas o puntuación en los extremos, y siempre devuelve un fragmento presente tal cual en el texto de referencia.

- *Alternativa:* persistir el texto anonimizado. Se descarta: pierde información útil para la educadora y contradice la decisión «Guardrail antes de Claude, no antes de persistir».

### D6. Guardrail falla cerrado

- Con `proveedor: 'bedrock'`, `crearProveedor` lanza `ErrorIa('CONFIGURACION_INVALIDA')` si falta `guardrail` y no se pidió `sinGuardrail: true`.
- Si `ApplyGuardrail` devuelve `GUARDRAIL_INTERVENED` sin texto en `outputs`, lanzar `ErrorIa('GUARDRAIL_NO_DISPONIBLE')`; **nunca** continuar con el texto original. Si devuelve `NONE`, se usa el texto sin cambios.
- Errores de red o del servicio del Guardrail se propagan tal cual (transitorios → la cola SQS reintenta).

### D7. Errores

- Propagar sin envolver los errores del SDK de Bedrock (`ThrottlingException`, `ServiceUnavailableException`, `ModelNotReadyException`, `ModelTimeoutException`, `InternalServerException`): Lambda los expone por `error.name` y, en el pipeline, la cola SQS reintenta el mensaje (`maxReceiveCount: 3`). `ErrorIa` debe traducirse a `ErrorPermanente` en el adaptador de `apps/pipeline`, que informa a la API sin reintentar.
- `ErrorIa` (con `name = 'ErrorIa'` y `codigo`) para fallas que reintentar no arregla: `FOTO_NO_VALIDA` (formato distinto de `jpeg`/`png` o más de 3,75 MB; el mensaje se muestra a la educadora, sin datos técnicos), `GUARDRAIL_NO_DISPONIBLE`, `CONFIGURACION_INVALIDA`.
- Texto insuficiente o sin respaldo **no es un error**: es un `BorradorEntrante` con `evidenciaInsuficiente: true`, `nivelSugerido: null`, `manifestaciones: []`.

### D8. Proveedor `fake`

Determinista y sin red, para que el pipeline y la CI trabajen sin AWS. A diferencia del `fake` de la API (palabras clave por los 5 dominios), el del módulo es **independiente de la rúbrica**: normaliza (minúsculas, sin tildes), toma las manifestaciones del `nivelEsperado` y puntúa cada una por coincidencias de palabras (prefijo de 5 caracteres, ignorando palabras de menos de 4 letras) con la nota; elige la de mayor puntaje (desempate por `id`) si alcanza un mínimo de 1 coincidencia (con el catálogo real, 2 dejaba casi toda nota en evidencia insuficiente); cita = primera oración de la nota (máx. 160 caracteres); si nada alcanza el mínimo o el texto es corto, evidencia insuficiente. `proveedor: 'fake'`, sin `modelo`. `normalizarFoto` devuelve una de dos lecturas fijas elegida por una semilla del contenido de los bytes.

El `fake` de la API (`ia-fake.ts`) queda intacto; unificarlos es trabajo posterior.

### D9. Helpers de normalización a texto

- `normalizarTexto`: recorta, colapsa espacios y saltos repetidos, normaliza a NFC. No cambia mayúsculas ni puntuación (las citas deben seguir siendo literales).
- `textoDeTranscripcion(json)`: lee `results.transcripts[].transcript` del JSON de Transcribe, une con espacio y recorta; devuelve cadena vacía si no hay transcripción; lanza un error claro si el JSON es inválido. Pura: la Lambda lee el objeto de S3 y le pasa el texto del JSON.
- `normalizarFoto` (bedrock): `ConverseCommand` multimodal con la imagen como bytes y una instrucción fija: describir en 1 a 3 oraciones lo que hace el niño o niña, sin nombres ni rasgos físicos; si no se ve actividad, responder exactamente `Sin actividad observable.`. Validar formato y tamaño **antes** de llamar (`FOTO_NO_VALIDA`). Devuelve el texto o `(sin texto reconocible)` si viene vacío. La descripción pasa luego por `extraer`, que aplica el Guardrail.

### D10. Pruebas

- `vitest`; cliente de Bedrock simulado inyectado (`cliente: { send: vi.fn() }`) que responde según el tipo de comando. Cubre: anonimización con mapeo de citas, reintento con problemas, evidencia insuficiente tras dos fallos, texto corto sin llamadas al modelo, Guardrail ausente o sin resultado, solicitud sin identificadores, foto inválida, propagación de errores del SDK.
- Una prueba con rúbrica de 8 niveles × 10 núcleos sintética y otra con la del dataset (9 × 5) prueban la parametrización.
- Prueba manual opcional contra Bedrock real, solo si `RUN_BEDROCK_LIVE=1` (`describe.skipIf`), con el perfil `toqui`; nunca corre en CI.
- Datos de prueba sintéticos; sin nombres ni RUT reales (usar valores obviamente ficticios).

### D11. Integración con la Lambda `proceso` (cambio posterior)

`ProveedorBedrock.extraer` hace Guardrail, validación y reintento, y el orquestador de `apps/pipeline` ya hace lo mismo (`AnonimizadorGuardrail`, `validarClasificacion`, dos intentos): conectarlo tal cual duplicaría el Guardrail, la validación y las llamadas al modelo (hasta 4). El puerto `Clasificador.clasificar(entrada)` espera la salida cruda del modelo. Por eso el siguiente paso es exponer desde `@toqui/ia` solo esa parte (prompt, herramienta y llamada a Converse, más las citas ubicadas con `ubicarCita`) y escribir en `apps/pipeline/src/ia/` un `ClasificadorBedrock` que la use y que agregue `bedrock` a `IA_PROVIDER`. No forma parte de este cambio: toca `apps/pipeline`.

- *Divergencia conocida:* el pipeline de `main` guarda como `textoFuente` el texto anonimizado; este módulo devuelve el original con las citas mapeadas (D5). Mientras el módulo no esté conectado no hay conflicto; antes de conectarlo hay que elegir una de las dos.

## Risks / Trade-offs

- [Claude cita fragmentos con marcadores y el mapeo al original falla o es ambiguo] → regex perezosa, primera coincidencia, un reintento y luego evidencia insuficiente; pruebas con varios marcadores y citas sin marcadores.
- [El Guardrail reemplaza texto que no es dato personal y altera el sentido] → solo afecta lo que ve el modelo; el original se conserva; la educadora revisa siempre.
- [El modelo no acepta forzar la herramienta o cambia el formato de `toolUse`] → `toolChoice: auto`, respuesta sin herramienta cuenta como inválida y entra al reintento; prueba manual con el perfil `toqui` antes del 16-10.
- [Throttling de Bedrock durante la demo] → los errores transitorios se propagan para los reintentos de la cola SQS; el módulo no reintenta por su cuenta salvo el reintento de validación.
- [Dos `fake` distintos (API y módulo) pueden divergir] → se acepta por ahora; unificar si sobra tiempo.
- [`NivelSchema` limita a 9 niveles] → fuera de alcance; se documenta.
- [El módulo envía a Claude una nota que el Guardrail no reconoce como dato personal] → el Guardrail cubre nombre, correo, teléfono, dirección y RUT; no es una garantía absoluta, y la nota es sintética en la demo.

## Migration Plan

Cambio aditivo en un paquete nuevo; no hay migración de datos ni de despliegue. Orden: (1) fusionar este cambio, (2) un cambio aparte agrega `@toqui/ia` a `apps/pipeline` con un adaptador `ClasificadorBedrock` del puerto `Clasificador` (tarea 4.2 de `cola-ia-y-amplify`; ver D11), (3) opcional: la API usa el módulo en modo inline. Para revertir basta con eliminar el paquete; nada en `main` depende de él todavía.

## Open Questions

- ¿Qué texto se guarda como `textoFuente`: el anonimizado (como hoy en el pipeline de `main`, D5 de `cola-ia-y-amplify`) o el original con las citas mapeadas (D5 de este cambio)? Decidir antes de conectar el módulo a la Lambda `proceso`.
- ¿El modelo `us.anthropic.claude-sonnet-5-5` acepta `toolChoice` forzado en Converse? Comprobarlo con el perfil `toqui`; si lo acepta, preferirlo sobre `auto`.
- ¿La cuenta del evento tiene acceso habilitado al modelo y al Guardrail desplegado (`pnpm aws:env` entrega `BEDROCK_GUARDRAIL_ID` y `BEDROCK_GUARDRAIL_VERSION`)?
- Si la rúbrica institucional (8 niveles × 8 a 10 núcleos) se usa algún día en lugar de la ruta sintética, ¿quién decide la equivalencia y cómo se amplía `NivelSchema`?
