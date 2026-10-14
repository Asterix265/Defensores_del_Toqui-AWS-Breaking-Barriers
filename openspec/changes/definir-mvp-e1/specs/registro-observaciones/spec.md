## ADDED Requirements

### Requirement: Captura multiformato de observaciones
El sistema SHALL permitir que una educadora autenticada registre una captura para un niño o niña de su jardín en formato texto, audio o foto. Los archivos de audio y foto SHALL subirse directamente a almacenamiento privado mediante una URL prefirmada, sin pasar por la API.

#### Scenario: Captura de texto
- **WHEN** la educadora selecciona a `NINO-00002` y envía una nota de texto
- **THEN** el sistema crea una captura con identificador único, formato `texto` y estado `procesando`

#### Scenario: Captura de audio
- **WHEN** la educadora graba una nota de voz y la envía
- **THEN** la app solicita una URL prefirmada, sube el archivo directamente al bucket privado y la captura queda en estado `procesando`

#### Scenario: Niño o niña de otro jardín
- **WHEN** la educadora intenta registrar una captura para un niño o niña de otro jardín
- **THEN** el sistema rechaza la solicitud con error de autorización y no crea la captura

### Requirement: Revisión del borrador por la educadora
El sistema SHALL presentar el borrador generado por la IA como sugerencia editable, mostrando cada manifestación propuesta junto con la cita textual que la respalda. Ningún borrador SHALL convertirse en observación confirmada sin una acción explícita de la educadora.

#### Scenario: Confirmación sin cambios
- **WHEN** la educadora confirma un borrador sin modificarlo
- **THEN** el sistema guarda la observación confirmada con sus manifestaciones, el nivel y el vínculo a la captura de origen

#### Scenario: Corrección del borrador
- **WHEN** la educadora quita una manifestación, agrega otra del catálogo o cambia el nivel antes de confirmar
- **THEN** el sistema guarda la versión corregida como observación confirmada y conserva la sugerencia original de la IA

#### Scenario: Descarte
- **WHEN** la educadora descarta un borrador
- **THEN** el sistema no crea una observación confirmada y registra el descarte

### Requirement: Trazabilidad de la evidencia
Cada observación confirmada SHALL conservar su identificador, fecha, formato de captura, educadora, niño o niña, manifestaciones vinculadas y la referencia a la captura y al texto de origen.

#### Scenario: Consulta del origen
- **WHEN** se consulta una observación confirmada
- **THEN** la respuesta incluye las manifestaciones con sus citas y la referencia a la captura que las originó

### Requirement: Procesamiento idempotente
El sistema SHALL generar como máximo un borrador por captura, aunque el pipeline reintente pasos.

#### Scenario: Reintento del pipeline
- **WHEN** el pipeline procesa dos veces la misma captura por un reintento
- **THEN** existe un único borrador asociado a esa captura
