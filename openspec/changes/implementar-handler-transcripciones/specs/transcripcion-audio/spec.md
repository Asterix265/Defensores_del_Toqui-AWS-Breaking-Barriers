## ADDED Requirements

### Requirement: Entrada validada y trazable
El pipeline SHALL validar una captura de audio mediante un contrato compartido que conserve identificador, bucket, clave, identidad del objeto e idioma. SHALL admitir solo el bucket y prefijo configurados y formatos de audio probados dentro de los límites documentados.

#### Scenario: Audio sintético válido
- **WHEN** llega una captura sintética existente en el bucket permitido con formato y tamaño admitidos
- **THEN** el pipeline conserva su identidad y comienza el procesamiento con el idioma configurado

#### Scenario: Archivo no admitido
- **WHEN** llega una foto, una clave fuera de `capturas/`, un archivo inexistente o un audio que excede los límites
- **THEN** el pipeline rechaza la entrada con un código de error explícito sin iniciar una transcripción

### Requirement: Transcripción asíncrona
El pipeline SHALL iniciar Amazon Transcribe y consultar su estado con esperas de Step Functions, sin mantener una Lambda esperando hasta que termine. SHALL acotar el tiempo total y tratar estados fallidos como errores.

#### Scenario: Trabajo en curso
- **WHEN** Transcribe responde que el trabajo sigue en proceso
- **THEN** la invocación termina y Step Functions espera antes de volver a consultar dentro del plazo configurado

#### Scenario: Trabajo terminado
- **WHEN** Transcribe completa un audio sintético
- **THEN** el handler obtiene el texto literal del resultado privado y lo prepara para su protección y persistencia sin generar un resumen

#### Scenario: Fallo o vencimiento
- **WHEN** Transcribe falla o se agota el plazo de espera controlado
- **THEN** el pipeline intenta persistir un estado fallido con código seguro y termina sin reportar una transcripción completada

### Requirement: Resultado protegido
El sistema SHALL aplicar el Guardrail configurado al texto antes de persistirlo y SHALL almacenar como texto durable solo la versión anonimizada. SHALL mantener resultados temporales privados fuera del prefijo de entrada con la retención configurada y sin registrar el texto en logs o en la salida de las tareas de Step Functions.

#### Scenario: Identificadores sintéticos en el audio
- **WHEN** una transcripción de prueba incluye un nombre o un RUT sintético detectado por la política
- **THEN** la versión durable oculta los datos detectados y conserva la referencia privada al origen

#### Scenario: Guardrail no disponible
- **WHEN** el filtrado falla o bloquea el resultado
- **THEN** el sistema registra el fallo y no guarda el texto original como alternativa

### Requirement: Persistencia autenticada mediante la API
La Lambda SHALL solicitar la persistencia a la API mediante un endpoint de servicio autenticado. La API SHALL validar firma, vigencia y contrato antes de escribir mediante Prisma en Aurora, y SHALL confirmar éxito solo tras el commit. La Lambda SHALL NOT requerir acceso directo a Aurora.

#### Scenario: Entrega legítima
- **WHEN** el handler entrega un resultado válido con firma de servicio vigente
- **THEN** la API confirma la escritura del estado, texto anonimizado y referencias de origen

#### Scenario: Firma inválida o mensaje alterado
- **WHEN** una petición carece de firma válida, tiene timestamp vencido o cambia su cuerpo después de firmarse
- **THEN** la API la rechaza sin modificar la base de datos

### Requirement: Idempotencia y consistencia de origen
El pipeline SHALL identificar establemente cada objeto de captura y reutilizar un trabajo de Transcribe compatible. La base SHALL mantener un único registro por identidad de origen y SHALL impedir que mensajes tardíos degraden un resultado completado. SHALL detectar un cambio de identidad del archivo en ejecución.

#### Scenario: Evento o entrega duplicados
- **WHEN** se procesa dos veces el mismo evento o se reenvía una entrega porque se perdió la respuesta HTTP
- **THEN** el sistema reutiliza el trabajo compatible y mantiene una sola fila sin duplicar la transcripción

#### Scenario: Mensaje atrasado
- **WHEN** llega un estado procesando o fallido después de una entrega completada para la misma identidad
- **THEN** el resultado completado permanece intacto

#### Scenario: Audio reemplazado
- **WHEN** la identidad actual del objeto difiere de la registrada al comenzar
- **THEN** esa ejecución falla sin atribuir el texto del nuevo objeto a la captura anterior

### Requirement: Ausencia de texto y errores explícitos
El sistema SHALL distinguir una transcripción completada de una captura sin texto y de un fallo técnico. SHALL NOT inventar contenido, manifestaciones, niveles ni diagnósticos para completar un resultado vacío.

#### Scenario: Audio sin voz reconocible
- **WHEN** un audio sintético produce una transcripción vacía
- **THEN** el registro queda en estado sin texto y no contiene una observación pedagógica generada

#### Scenario: API temporalmente no disponible
- **WHEN** la entrega recibe un error transitorio
- **THEN** se reintenta con backoff hasta el máximo configurado y, si persiste, la ejecución queda fallida y puede reprocesarse con la misma identidad

### Requirement: Verificación reproducible
El desarrollo SHALL permitir pruebas de contratos, estados, protección, autenticación e idempotencia sin credenciales mediante dobles explícitos. La verificación AWS SHALL usar solo audios sintéticos con procedencia y referencia documentadas y SHALL reportar resultados medidos.

#### Scenario: Desarrollo local
- **WHEN** se ejecutan las pruebas con clientes externos sustituidos
- **THEN** se verifican éxito, espera, fallo, texto vacío, entrega duplicada y firma inválida sin llamar a AWS ni etiquetar resultados como transcripciones reales

#### Scenario: Prueba integrada sintética
- **WHEN** se realiza una prueba posterior autorizada en AWS con una muestra documentada
- **THEN** se comprueban el texto persistido, la identidad única, la latencia y las diferencias con la referencia, sin afirmar que se alcanzó la meta institucional
