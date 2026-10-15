## ADDED Requirements

### Requirement: Módulo de IA puro y con contrato estable
El paquete `@toqui/ia` SHALL exportar `crearProveedor`, `validar`, `normalizarTexto`, `textoDeTranscripcion`, `ErrorIa` y los tipos `IaProvider`, `ConfigIa`, `ContextoExtraccion`, `ManifestacionCatalogo` y `ResultadoValidacion`, y SHALL NOT depender de NestJS, Prisma, clientes de S3 ni del cliente de la API interna. Recibe texto, edad en meses, nivel esperado y catálogo, y SHALL devolver un `BorradorEntrante` del contrato de `@toqui/shared`.

#### Scenario: Uso desde una Lambda
- **WHEN** una Lambda importa `@toqui/ia`, crea un proveedor y llama a `extraer(texto, contexto)`
- **THEN** obtiene un `BorradorEntrante` que supera `BorradorEntranteSchema.parse` sin conversiones

#### Scenario: Sin dependencias de aplicación
- **WHEN** se revisan las dependencias de `packages/ia/package.json`
- **THEN** solo aparecen `@toqui/shared`, `zod` y `@aws-sdk/client-bedrock-runtime` como dependencias de ejecución

#### Scenario: Catálogo de la API aceptado sin conversión
- **WHEN** se pasa como catálogo un arreglo de `Manifestacion` de `@toqui/shared`
- **THEN** el compilador de TypeScript lo acepta como `ManifestacionCatalogo[]`

### Requirement: Proveedor seleccionable por configuración
`crearProveedor(config)` SHALL devolver el proveedor `fake` o el proveedor `bedrock` según `config.proveedor`, sin leer `process.env`. Con `bedrock`, el Guardrail SHALL ser obligatorio salvo que la configuración indique explícitamente `sinGuardrail: true`.

#### Scenario: Proveedor fake
- **WHEN** se llama a `crearProveedor({ proveedor: 'fake' })`
- **THEN** el proveedor tiene `nombre` igual a `fake` y funciona sin credenciales de AWS ni acceso a la red

#### Scenario: Bedrock sin Guardrail
- **WHEN** se llama a `crearProveedor({ proveedor: 'bedrock', modelo })` sin `guardrail` ni `sinGuardrail`
- **THEN** lanza `ErrorIa` con código `CONFIGURACION_INVALIDA`

#### Scenario: Bedrock sin Guardrail en desarrollo
- **WHEN** se llama a `crearProveedor({ proveedor: 'bedrock', modelo, sinGuardrail: true })`
- **THEN** devuelve un proveedor `bedrock` que no aplica Guardrail

### Requirement: Extracción acotada al catálogo con citas literales
`extraer` SHALL devolver solo identificadores presentes en el catálogo recibido, todos del mismo nivel y dentro de los niveles del catálogo, entre 1 y 5 manifestaciones sin repetir, y cada cita SHALL aparecer literalmente en `textoFuente`. El `textoFuente` devuelto SHALL ser el texto original normalizado.

#### Scenario: Extracción válida
- **WHEN** la nota «Apiló cuatro bloques solo y aplaudió cuando no se cayeron» se extrae con un catálogo que incluye `MAN-L07-MF-01` («Apila 4 bloques») en el nivel esperado
- **THEN** el borrador incluye `MAN-L07-MF-01` con una cita que está literalmente en la nota, `nivelSugerido` 7 y `evidenciaInsuficiente` en falso

#### Scenario: Identificador fuera del catálogo
- **WHEN** el modelo propone `MAN-L99-XX-01`, que no está en el catálogo
- **THEN** la validación falla con un problema que nombra ese identificador y el borrador no se entrega como válido

#### Scenario: Niveles mezclados
- **WHEN** el modelo propone manifestaciones de dos niveles distintos
- **THEN** la validación falla con un problema que indica el nivel esperado de todas

#### Scenario: Cita inexistente
- **WHEN** una cita propuesta no aparece en el texto ni siquiera ignorando mayúsculas, espacios repetidos o comillas en los extremos
- **THEN** la validación falla con un problema que nombra la manifestación

#### Scenario: Cita con diferencias menores
- **WHEN** el modelo cita «apiló cuatro  bloques» con distinta capitalización y un espacio doble
- **THEN** la validación acepta la cita y devuelve el fragmento exactamente como está en el texto

#### Scenario: Más manifestaciones que el máximo
- **WHEN** el modelo propone 6 manifestaciones
- **THEN** la validación falla porque el máximo es 5

### Requirement: Reintento y evidencia insuficiente
Si la propuesta del modelo no es válida, el proveedor `bedrock` SHALL reintentar una sola vez entregando al modelo los problemas detectados, y si el segundo intento también falla o no trae contenido, SHALL devolver un borrador con `evidenciaInsuficiente` en verdadero, `nivelSugerido` en `null` y sin manifestaciones. Un texto de menos de 20 caracteres SHALL producir evidencia insuficiente sin llamar al Guardrail ni al modelo.

#### Scenario: Corrección en el segundo intento
- **WHEN** la primera respuesta del modelo usa un identificador inexistente y la segunda es válida
- **THEN** se hacen exactamente dos llamadas al modelo, la segunda incluye los problemas de la primera, y el borrador devuelto es el válido

#### Scenario: Dos intentos fallidos
- **WHEN** ambas respuestas del modelo son inválidas
- **THEN** el borrador queda con evidencia insuficiente, sin nivel sugerido y sin manifestaciones

#### Scenario: Nota demasiado corta
- **WHEN** la nota es «Asistió hoy.»
- **THEN** el borrador queda con evidencia insuficiente y no se realizó ninguna llamada a Bedrock

#### Scenario: El modelo declara evidencia insuficiente
- **WHEN** el modelo responde `evidenciaInsuficiente: true`
- **THEN** el borrador devuelto ignora cualquier manifestación o nivel que acompañe esa respuesta

### Requirement: Rúbrica parametrizable
El módulo SHALL derivar los niveles y los núcleos o dominios válidos exclusivamente del catálogo recibido, sin constantes de cantidad de niveles ni de nombres de núcleos, de modo que funcione con 8 o 9 niveles y con 5 a 10 núcleos.

#### Scenario: Ruta del dataset
- **WHEN** el catálogo tiene 9 niveles y 5 dominios (`motor_grueso`, `motor_fino`, `lenguaje_comunicacion`, `socioemocional`, `cognitivo`)
- **THEN** la extracción y la validación funcionan y aceptan cualquier nivel presente en ese catálogo

#### Scenario: Rúbrica de 8 niveles y 10 núcleos
- **WHEN** el catálogo sintético tiene 8 niveles y 10 núcleos con nombres que el módulo no conoce
- **THEN** la extracción y la validación funcionan igual, y el prompt muestra los núcleos tal como vienen en el catálogo

#### Scenario: Nivel que no está en el catálogo
- **WHEN** el modelo propone el nivel 9 y el catálogo solo contiene los niveles 6, 7 y 8
- **THEN** la validación falla porque el nivel no está entre los del catálogo entregado

### Requirement: Protección de datos personales ante el modelo
El proveedor `bedrock` SHALL aplicar el Guardrail al texto antes de enviarlo a Claude, SHALL enviar al modelo solo la nota, la edad en meses, el nivel esperado y el catálogo, y SHALL fallar sin llamar al modelo si el Guardrail no entrega un resultado utilizable. El `textoFuente` devuelto SHALL ser el texto original, y las citas SHALL ubicarse en ese texto aunque el modelo las haya tomado de la versión anonimizada.

#### Scenario: Anonimización antes del modelo
- **WHEN** la nota contiene «Martina Rojas dijo mamá» y el Guardrail la devuelve como «{NAME} dijo mamá»
- **THEN** la solicitud a Claude contiene «{NAME} dijo mamá» y no contiene «Martina Rojas»

#### Scenario: Cita con marcador mapeada al original
- **WHEN** el modelo cita «{NAME} dijo mamá» y el texto original es «Martina Rojas dijo mamá»
- **THEN** el borrador devuelve la cita «Martina Rojas dijo mamá» y su `textoFuente` es el texto original

#### Scenario: Solicitud sin identificadores
- **WHEN** se inspecciona el comando enviado a Claude
- **THEN** no contiene `id_nino`, `id_captura`, nombres ni RUT, solo la nota anonimizada, la edad, el nivel esperado y el catálogo

#### Scenario: Guardrail intervino sin texto
- **WHEN** el Guardrail responde `GUARDRAIL_INTERVENED` sin texto de salida
- **THEN** `extraer` lanza `ErrorIa` con código `GUARDRAIL_NO_DISPONIBLE` y no llama a Claude

#### Scenario: Guardrail sin cambios
- **WHEN** el Guardrail responde sin intervenir
- **THEN** se envía a Claude el texto sin cambios

### Requirement: Normalización a texto
El módulo SHALL ofrecer `normalizarTexto` (recorta y colapsa espacios sin alterar mayúsculas ni puntuación), `textoDeTranscripcion` (extrae el texto de un resultado de Amazon Transcribe) y `normalizarFoto` (describe lo observable de una foto con un modelo multimodal), y SHALL rechazar fotos que no sean JPEG o PNG o que superen 3,75 MB antes de llamar al modelo.

#### Scenario: Transcripción de Transcribe
- **WHEN** `textoDeTranscripcion` recibe el JSON de Transcribe con `results.transcripts[0].transcript` igual a « Apiló bloques. »
- **THEN** devuelve «Apiló bloques.»

#### Scenario: Transcripción vacía
- **WHEN** el JSON de Transcribe no trae transcripciones
- **THEN** `textoDeTranscripcion` devuelve una cadena vacía

#### Scenario: Foto muy pesada
- **WHEN** `normalizarFoto` recibe una imagen de 5 MB
- **THEN** lanza `ErrorIa` con código `FOTO_NO_VALIDA` y un mensaje legible que indica el máximo de 3,75 MB, sin llamar al modelo

#### Scenario: Foto sin actividad
- **WHEN** el modelo responde «Sin actividad observable.»
- **THEN** `normalizarFoto` devuelve ese texto y la extracción posterior termina con evidencia insuficiente

#### Scenario: Normalización de texto
- **WHEN** `normalizarTexto` recibe «  Apiló   cuatro\n\nbloques.  »
- **THEN** devuelve «Apiló cuatro bloques.»

### Requirement: Errores transitorios y no transitorios distinguibles
El módulo SHALL propagar sin envolver los errores del SDK de Bedrock (para que Step Functions los reintente por su nombre) y SHALL lanzar `ErrorIa` con `name` igual a `ErrorIa` y un código para las fallas que reintentar no corrige.

#### Scenario: Throttling de Bedrock
- **WHEN** Bedrock responde con un error de nombre `ThrottlingException`
- **THEN** `extraer` lanza ese mismo error, con su nombre original, sin consumir el reintento de validación

#### Scenario: Falla no reintentable
- **WHEN** ocurre `FOTO_NO_VALIDA`
- **THEN** el error es una instancia de `ErrorIa` con `name` igual a `ErrorIa` y `codigo` igual a `FOTO_NO_VALIDA`

### Requirement: Proveedor fake determinista
El proveedor `fake` SHALL producir el mismo borrador para las mismas entradas, sin red ni credenciales, usando solo el catálogo recibido (coincidencia de palabras entre la nota y el texto observable de las manifestaciones del nivel esperado), y su resultado SHALL superar `validar`.

#### Scenario: Borrador determinista
- **WHEN** se llama dos veces a `extraer` con la misma nota y el mismo catálogo
- **THEN** ambos borradores son idénticos y `proveedor` es `fake`

#### Scenario: Sin coincidencias
- **WHEN** la nota no comparte palabras suficientes con ninguna manifestación del nivel esperado
- **THEN** el borrador queda con evidencia insuficiente

#### Scenario: Rúbrica desconocida
- **WHEN** el catálogo usa núcleos con nombres que el fake no conoce
- **THEN** igualmente propone una manifestación si hay coincidencia de palabras

### Requirement: Lenguaje no diagnóstico
El prompt de extracción SHALL presentar el nivel como una estimación pedagógica sujeta a revisión de la educadora, SHALL indicar al modelo que no infiera más allá de lo escrito, y el módulo SHALL NOT incluir afirmaciones diagnósticas en los textos que genera.

#### Scenario: Instrucciones del sistema
- **WHEN** se inspecciona el mensaje de sistema enviado a Claude
- **THEN** indica que el nivel es una estimación para revisión de la educadora, que no es un diagnóstico y que debe marcarse evidencia insuficiente si la nota no respalda ninguna manifestación

### Requirement: Pruebas sin AWS
Las pruebas del paquete SHALL ejecutarse sin credenciales de AWS ni acceso a la red usando un cliente de Bedrock simulado, y toda prueba contra Bedrock real SHALL ser opcional y quedar desactivada salvo que se defina `RUN_BEDROCK_LIVE=1`.

#### Scenario: Ejecución en CI
- **WHEN** se ejecuta `pnpm --filter @toqui/ia test` sin credenciales de AWS
- **THEN** todas las pruebas pasan y las pruebas contra Bedrock real figuran como omitidas
