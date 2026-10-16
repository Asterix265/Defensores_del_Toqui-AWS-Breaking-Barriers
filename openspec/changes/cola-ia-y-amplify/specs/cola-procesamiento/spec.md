## Purpose

Procesar cada captura de la educadora de forma asíncrona, fuera de la petición HTTP, con reintentos, cola de errores y entrega idempotente del borrador, para absorber picos sin perder trabajo.

## ADDED Requirements

### Requirement: Encolado de notas de texto
Al crear una captura de texto, la API SHALL encolar un trabajo de procesamiento y responder sin esperar el resultado.

#### Scenario: Nota de texto registrada
- **WHEN** una educadora crea una captura de texto válida
- **THEN** la API responde 201 con la captura en estado `procesando` y existe un mensaje en la cola con el id de esa captura

#### Scenario: Cola no disponible
- **WHEN** la API no logra encolar el trabajo
- **THEN** la captura queda en estado `error` con un detalle legible y la API responde 503

### Requirement: Encolado de archivos al terminar la subida
Para capturas de audio o foto, la API SHALL encolar el trabajo solo cuando la web informa que terminó la subida y el archivo existe en el almacenamiento con el tipo declarado.

#### Scenario: Subida confirmada
- **WHEN** la educadora dueña de una captura de audio en `procesando` informa que terminó la subida y el archivo existe con el tipo declarado
- **THEN** la API encola el trabajo y responde con la captura en estado `procesando`

#### Scenario: Archivo inexistente
- **WHEN** se informa la subida terminada pero el archivo no existe o tiene otro tipo
- **THEN** la API responde 409 y no encola ningún trabajo

#### Scenario: Aviso repetido
- **WHEN** la web informa dos veces que terminó la subida de la misma captura
- **THEN** la API encola como máximo un trabajo por captura y la segunda respuesta devuelve el estado actual

### Requirement: Mensaje sin datos personales
El mensaje de la cola SHALL contener solo lo necesario para procesar: id de captura, identificador opaco de quien registró, formato, texto o clave del archivo, id del jardín, edad en meses y catálogo completo de manifestaciones. SHALL NOT contener nombres, RUT ni el id del niño o niña.

#### Scenario: Contenido del mensaje
- **WHEN** se encola una captura
- **THEN** el mensaje no incluye `id_nino`, nombres ni RUT y el procesamiento no necesita consultar la base de datos

### Requirement: Resultado de cada trabajo
Cada trabajo SHALL terminar entregando un borrador válido según el contrato o informando un error a la API, que actualiza el estado de la captura.

#### Scenario: Procesamiento exitoso
- **WHEN** el trabajo de una nota con conductas observables termina bien
- **THEN** la captura pasa a `borrador_listo` con el borrador y se registra el evento de tiempo `borrador_listo`

#### Scenario: Fallo definitivo
- **WHEN** un trabajo falla en todos sus intentos
- **THEN** el mensaje queda en la cola de errores y la captura pasa a `error` con un detalle legible

### Requirement: Reintentos y cola de errores
Un trabajo que falla por una causa transitoria SHALL reintentarse automáticamente un número limitado de veces antes de pasar a la cola de errores.

#### Scenario: Limitación temporal del modelo
- **WHEN** el modelo rechaza la llamada por cuota en el primer intento y responde en el segundo
- **THEN** la captura llega a `borrador_listo` sin intervención de la educadora

### Requirement: Entrega idempotente
La entrega de un borrador SHALL ser idempotente por captura: un trabajo duplicado no crea un segundo borrador ni cambia una captura ya confirmada o descartada.

#### Scenario: Mensaje entregado dos veces
- **WHEN** la cola entrega dos veces el mismo trabajo
- **THEN** la captura tiene un solo borrador y su estado no retrocede

### Requirement: Concurrencia acotada
El procesamiento SHALL limitar la cantidad de trabajos simultáneos a un máximo configurable; los trabajos excedentes esperan en la cola.

#### Scenario: Pico de capturas
- **WHEN** llegan más capturas que el máximo de trabajos simultáneos
- **THEN** las excedentes permanecen en `procesando` hasta que haya capacidad y ninguna pasa a `error` por esa causa

### Requirement: Conexión con almacenamiento y cola
El endpoint de salud SHALL informar por separado el estado de la base de datos, del almacenamiento de capturas y de la cola, y SHALL indicar `degraded` si alguna no responde.

#### Scenario: Cola inaccesible
- **WHEN** la API no puede consultar la cola
- **THEN** `/health` responde con la cola en `down`, el estado general `degraded` y la base y el almacenamiento con su propio estado

### Requirement: Modo local sin AWS
En desarrollo, el procesamiento SHALL poder ejecutarse dentro de la API con el proveedor `fake`, sin cola ni credenciales de AWS, cumpliendo el mismo contrato de borrador.

#### Scenario: Desarrollo local
- **WHEN** la API corre con `PIPELINE_MODE=inline` e `IA_PROVIDER=fake`
- **THEN** una nota de texto llega a `borrador_listo` sin llamadas a AWS
