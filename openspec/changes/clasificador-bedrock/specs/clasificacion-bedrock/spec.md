## ADDED Requirements

### Requirement: Clasificación con Claude mediante herramienta
`clasificarConClaude` de `@toqui/ia` SHALL llamar una sola vez a Converse con el mensaje de sistema, el mensaje de usuario y la herramienta `registrar_borrador` con `toolChoice` en `auto`, y SHALL devolver la salida cruda del modelo con la forma `{ nivelSugerido, evidenciaInsuficiente, manifestaciones }`, sin validarla ni reintentar.

#### Scenario: Respuesta con la herramienta
- **WHEN** el modelo responde con un bloque `toolUse` de `registrar_borrador` con `evidenciaInsuficiente` en falso, `nivel` 7 y una manifestación con su cita
- **THEN** la función devuelve `nivelSugerido` 7, `evidenciaInsuficiente` en falso y esa manifestación, sin el campo `nivel`

#### Scenario: Una sola llamada al modelo
- **WHEN** la respuesta del modelo no cumple el esquema esperado
- **THEN** la función igualmente hace una sola llamada a Converse y devuelve lo recibido, porque la validación y el reintento los hace el orquestador

#### Scenario: Respuesta sin herramienta
- **WHEN** el modelo responde solo con texto, sin bloque `toolUse`
- **THEN** la función devuelve un objeto vacío, que el orquestador reconocerá como inválido

#### Scenario: Parámetros de la llamada
- **WHEN** se inspecciona el comando enviado a Converse
- **THEN** incluye el identificador del modelo recibido, un único mensaje de usuario, la herramienta `registrar_borrador`, `toolChoice` igual a `auto` y `maxTokens` igual a 1500

### Requirement: Salida normalizada para la validación del pipeline
La salida de `clasificarConClaude` SHALL renombrar `nivel` como `nivelSugerido`, SHALL forzar `nivelSugerido` en `null` y `manifestaciones` vacía cuando `evidenciaInsuficiente` sea verdadero, y SHALL reemplazar cada cita por el fragmento literal del `textoFuente` cuando lo encuentre, tolerando mayúsculas, espacios repetidos y comillas o puntuación en los extremos. Si una cita no se encuentra, SHALL conservarla tal cual.

#### Scenario: Cita con diferencias menores
- **WHEN** el texto es «Apiló cuatro bloques solo.» y el modelo cita «apiló  cuatro bloques» con otra capitalización y un espacio doble
- **THEN** la cita devuelta es «Apiló cuatro bloques» tal como está en el texto, y `validarClasificacion` la acepta

#### Scenario: Cita que no está en el texto
- **WHEN** el modelo cita una frase que no aparece en el texto
- **THEN** la cita se devuelve sin cambios y `validarClasificacion` la rechaza con un problema que nombra la manifestación

#### Scenario: Evidencia insuficiente con restos
- **WHEN** el modelo marca `evidenciaInsuficiente` en verdadero pero deja `nivel` 5 y una manifestación
- **THEN** la función devuelve `nivelSugerido` en `null` y `manifestaciones` vacía

#### Scenario: Campos faltantes
- **WHEN** el modelo omite `evidenciaInsuficiente`
- **THEN** la función no lo inventa y la validación del orquestador reporta el campo faltante

### Requirement: Mensaje al modelo sin identificadores
El mensaje enviado a Claude SHALL contener únicamente la nota ya anonimizada, la edad en meses, el nivel esperado, el catálogo recibido y, cuando existan, los fragmentos de conocimiento, los casos parecidos y los problemas del intento anterior. SHALL NOT contener `idCaptura`, `idJardin`, `idUsuario` ni ningún otro dato que identifique al niño o niña o a la educadora. La nota SHALL ir entre etiquetas que no aparezcan dentro del texto.

#### Scenario: Solicitud mínima
- **WHEN** se clasifica una nota con un contexto que además trae `idCaptura`, `idJardin` y `idUsuario`
- **THEN** el texto de la solicitud no contiene ninguno de esos valores

#### Scenario: Nota con etiqueta de cierre
- **WHEN** la nota contiene `</nota>` seguido de instrucciones
- **THEN** la nota se delimita con una etiqueta distinta (`nota-1`) que no aparece en el texto

#### Scenario: Catálogo completo
- **WHEN** el catálogo recibido tiene manifestaciones de los niveles 3 a 9
- **THEN** el mensaje las agrupa por nivel ascendente con su núcleo tal como viene, sin restringirlas a una ventana alrededor del nivel esperado

### Requirement: Contexto opcional y corrección del intento anterior
El prompt SHALL incluir, solo cuando existan, hasta 5 fragmentos de conocimiento (cada uno recortado a 800 caracteres), hasta 5 casos parecidos (cada nota recortada a 400 caracteres, con su nivel y sus manifestaciones) y la lista de problemas del intento anterior. Cuando existan, el mensaje de sistema SHALL agregar la instrucción correspondiente. Sin esos datos, el mensaje de usuario SHALL coincidir con el de la extracción sin contexto.

#### Scenario: Corrección tras un intento inválido
- **WHEN** la entrada trae `correccion` con «MAN-L99-XX-01 no está en el catálogo permitido»
- **THEN** el mensaje de usuario incluye ese problema en una lista y pide corregirlo y volver a llamar a la herramienta

#### Scenario: Casos parecidos y conocimiento
- **WHEN** la entrada trae 2 fragmentos de conocimiento y 1 caso parecido
- **THEN** el mensaje incluye ambas secciones antes de la nota, y el sistema indica que son contexto y no fuente de citas

#### Scenario: Más de cinco elementos
- **WHEN** la entrada trae 8 fragmentos de conocimiento
- **THEN** el mensaje incluye solo los 5 primeros

#### Scenario: Sin contexto
- **WHEN** la entrada no trae conocimiento, casos ni corrección
- **THEN** el mensaje de usuario es idéntico al que produce la extracción sin contexto

### Requirement: Errores del modelo sin envolver y tiempo máximo
`clasificarConClaude` SHALL propagar sin envolver los errores del SDK de Bedrock, de modo que el handler `proceso` los trate como transitorios y la cola reintente el mensaje. Cada llamada SHALL cancelarse a los 60 000 ms, o al tiempo indicado, con una señal de cancelación.

#### Scenario: Límite de solicitudes
- **WHEN** Bedrock responde con un error de nombre `ThrottlingException`
- **THEN** la función lanza ese mismo error, con su nombre original

#### Scenario: Tiempo agotado
- **WHEN** la llamada a Converse supera el tiempo máximo
- **THEN** la señal de cancelación se activa y el error resultante se propaga al orquestador

#### Scenario: Señal de cancelación enviada
- **WHEN** se inspecciona el segundo argumento de `send`
- **THEN** contiene una `abortSignal` de 60 000 ms por defecto

### Requirement: Clasificador Bedrock en la Lambda de proceso
`apps/pipeline` SHALL ofrecer `ClasificadorBedrock`, que implementa el puerto `Clasificador` con `proveedor` igual a `bedrock` y el `modelo` configurado, y SHALL pasar a `clasificarConClaude` el texto anonimizado, la edad, el nivel esperado, el catálogo, el contexto y la corrección que entrega el orquestador. El borrador entregado SHALL llevar `proveedor` igual a `bedrock` y el `modelo`.

#### Scenario: Borrador entregado con Claude
- **WHEN** el orquestador procesa una nota de texto con `ClasificadorBedrock` y el modelo responde una propuesta válida del catálogo
- **THEN** la API recibe un borrador con `proveedor` `bedrock`, el `modelo` configurado, las manifestaciones y citas válidas, y un `procesamiento` donde la extracción figura como completada

#### Scenario: Reintento con corrección
- **WHEN** la primera respuesta usa un identificador que no está en el catálogo y la segunda es válida
- **THEN** el modelo se llama dos veces, la segunda solicitud incluye el problema de la primera y se entrega la propuesta válida

#### Scenario: Dos respuestas inválidas
- **WHEN** ambas respuestas son inválidas
- **THEN** se entrega un borrador con evidencia insuficiente, `proveedor` `bedrock` y sin nivel sugerido

#### Scenario: Error transitorio del modelo
- **WHEN** Bedrock lanza `ThrottlingException` durante la clasificación
- **THEN** la captura no recibe borrador, el error llega al handler y, antes del último intento, el mensaje vuelve a la cola sin informar error a la educadora

#### Scenario: Texto ya anonimizado
- **WHEN** el Guardrail devolvió «{NAME} apiló cuatro bloques» como texto anonimizado
- **THEN** ese es el texto que recibe Claude y el `textoFuente` del borrador, y las citas salen de ese texto

### Requirement: Selección del proveedor por configuración
La configuración de la Lambda SHALL aceptar `IA_PROVIDER` con los valores `fake` y `bedrock`, con `fake` por defecto, y `MODELO_EXTRACCION` con `us.anthropic.claude-sonnet-5-5` por defecto. `IA_PROVIDER=bedrock` combinado con `LECTOR_FOTO=ia` SHALL rechazarse al cargar la configuración con un mensaje claro. Con `fake`, el comportamiento actual SHALL permanecer sin cambios.

#### Scenario: Proveedor por defecto
- **WHEN** la configuración no define `IA_PROVIDER`
- **THEN** el proveedor es `fake`

#### Scenario: Bedrock con el modelo por defecto
- **WHEN** `IA_PROVIDER` es `bedrock` y no se define `MODELO_EXTRACCION`
- **THEN** las dependencias incluyen un `ClasificadorBedrock` con el modelo `us.anthropic.claude-sonnet-5-5`

#### Scenario: Bedrock con lectura de fotos por IA
- **WHEN** `IA_PROVIDER` es `bedrock` y `LECTOR_FOTO` es `ia`
- **THEN** la carga de la configuración falla indicando que debe usarse `LECTOR_FOTO=textract`

#### Scenario: Fake sin cambios
- **WHEN** `IA_PROVIDER` es `fake`
- **THEN** las dependencias incluyen el `ClasificadorFake` y las pruebas actuales del handler y del orquestador siguen pasando

### Requirement: Activación controlada en producción
La infraestructura SHALL fijar el proveedor de la Lambda de proceso mediante la constante `IA_PROVIDER_PROCESO`, cuyo valor inicial SHALL ser `fake`, y SHALL entregar a la Lambda `MODELO_EXTRACCION` con el modelo de extracción. El `timeout` de la Lambda SHALL ser de 180 segundos y el tiempo de visibilidad de la cola, 6 veces ese valor. Los permisos de la Lambda SHALL permanecer sin cambios.

#### Scenario: Síntesis con el valor inicial
- **WHEN** se sintetiza el stack de producción sin modificar la constante
- **THEN** la Lambda `toqui-prod-proceso` tiene `IA_PROVIDER` igual a `fake`, `MODELO_EXTRACCION` con el modelo de extracción y un `Timeout` de 180

#### Scenario: Visibilidad de la cola
- **WHEN** se sintetiza el stack de producción
- **THEN** la cola `toqui-prod-capturas` tiene un `VisibilityTimeout` de 1080 segundos

#### Scenario: Activación de una línea
- **WHEN** se cambia únicamente la constante `IA_PROVIDER_PROCESO` a `bedrock`
- **THEN** la síntesis deja `IA_PROVIDER` igual a `bedrock` en la Lambda sin otros cambios en el stack

### Requirement: Compilación de `@toqui/ia` antes de su consumidor
El repositorio SHALL compilar `@toqui/ia` y sus dependencias antes de revisar tipos, ejecutar pruebas o empaquetar `@toqui/pipeline`, en la integración continua y en los scripts de preparación y de despliegue de producción.

#### Scenario: Integración continua
- **WHEN** la CI corre desde una copia limpia con `pnpm install --frozen-lockfile`
- **THEN** el paso de preparación compila `@toqui/shared` y `@toqui/ia` antes de lint, tipos y pruebas, y todos pasan

#### Scenario: Empaquetado de la Lambda
- **WHEN** se ejecuta `pnpm --filter @toqui/pipeline build` después de compilar `@toqui/ia`
- **THEN** `dist/proceso.mjs` incluye el código de `@toqui/ia` y mantiene `@aws-sdk/*` como externo

### Requirement: Prueba en vivo opcional y desactivada por defecto
El paquete SHALL incluir una prueba contra Bedrock real que solo se ejecute con `RUN_BEDROCK_LIVE=1` y que SHALL quedar omitida en la CI y en las pruebas normales. Quien implemente el cambio SHALL NOT ejecutarla.

#### Scenario: Ejecución normal
- **WHEN** se ejecuta `pnpm --filter @toqui/ia test` sin credenciales de AWS
- **THEN** todas las pruebas pasan y la prueba en vivo figura como omitida
