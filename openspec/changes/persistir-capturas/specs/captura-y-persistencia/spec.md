# Spec Delta

## Purpose

La educadora registra texto, audio o foto desde la web; el archivo queda en S3, la API procesa la captura declarando qué está simulado y la decisión de la educadora queda guardada.

## ADDED Requirements

### Requirement: Captura de audio y foto
La web SHALL grabar audio con el micrófono del dispositivo y tomar o elegir una foto, y SHALL subir el archivo a S3 con la URL firmada que entrega la API, con el tipo y el tamaño declarados. La web SHALL solo subir a S3: SHALL NOT descargar el original desde S3, y la vista previa de la revisión SHALL usar el archivo local recién capturado. Cada nota SHALL crear una sola captura en la API. Si el navegador no permite el micrófono o la subida falla, SHALL mostrar el motivo y permitir cancelar.

#### Scenario: Audio subido a S3
- **WHEN** la educadora graba un audio, elige a un niño o niña y sigue
- **THEN** la web crea la captura, sube el audio a `capturas/<id>.<ext>` y avisa a la API que la subida terminó

#### Scenario: Una nota, una captura
- **WHEN** la educadora sigue con un niño o niña en desarrollo, donde React ejecuta dos veces los efectos
- **THEN** la API recibe un solo `POST /capturas`

#### Scenario: Lo que vuelve es el resultado procesado
- **WHEN** la revisión muestra el audio o la foto
- **THEN** los toma del archivo local, y de la API solo llega el borrador procesado

#### Scenario: Sin permiso de micrófono
- **WHEN** el navegador niega el micrófono
- **THEN** la app explica que no puede grabar y permite volver sin crear nada

### Requirement: Procesamiento solo con el archivo en S3
En modo `inline`, la API SHALL procesar una captura de audio o foto solo después de comprobar que el objeto existe en S3 con el tipo y el tamaño declarados.

#### Scenario: Aviso de subida antes de que llegue el archivo
- **WHEN** la web avisa la subida y el objeto no está en S3
- **THEN** la API responde 409 y la captura sigue en `procesando`

#### Scenario: Aviso repetido
- **WHEN** la web avisa la subida de una captura que ya tiene borrador
- **THEN** la API devuelve el detalle sin volver a procesar

### Requirement: Aviso de procesamiento simulado
El borrador SHALL declarar la entrada procesada (formato, tipo, tamaño y ubicación en S3) y el estado de cada paso. Mientras la transcripción y la lectura de imágenes no existan, SHALL figurar como no implementadas y el texto procesado SHALL ser un texto de ejemplo; la revisión SHALL mostrarlo en un aviso visible y rotular el texto como ejemplo.

#### Scenario: Revisión de un audio
- **WHEN** la API termina de procesar un audio en modo `inline` con la IA `fake`
- **THEN** la revisión muestra «Procesamiento simulado», el audio recibido con su tipo y tamaño, «Transcripción: no implementada» con el texto de ejemplo, y la propuesta de nivel y manifestaciones como simulada

### Requirement: Persistencia de la decisión
Confirmar SHALL guardar en la API el nivel y las manifestaciones elegidas; descartar SHALL registrar el descarte. Las notas confirmadas SHALL seguir visibles en «Mis notas», en el panel y en la ficha después de recargar.

#### Scenario: Nota confirmada tras recargar
- **WHEN** la educadora confirma una nota y recarga la página
- **THEN** la nota aparece en «Mis notas» y la observación aparece entre los registros de la ficha del niño o niña
