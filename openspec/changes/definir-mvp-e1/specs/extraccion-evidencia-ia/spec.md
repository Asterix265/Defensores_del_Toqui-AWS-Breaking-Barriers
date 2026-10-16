## ADDED Requirements

### Requirement: Normalización de la captura a texto
El pipeline SHALL convertir cada captura en texto antes de la extracción: el texto se usa directamente, el audio se transcribe y el texto de la foto se lee con OCR (Amazon Textract) o, como respaldo, con un modelo multimodal.

#### Scenario: Audio transcrito
- **WHEN** llega una captura de audio
- **THEN** el pipeline obtiene su transcripción y la usa como texto de entrada de la extracción

#### Scenario: Foto de una nota manuscrita
- **WHEN** llega una foto de una nota escrita a mano
- **THEN** el pipeline obtiene el texto legible de la nota y lo usa como entrada de la extracción

### Requirement: Extracción acotada al catálogo
La extracción SHALL recibir el texto, la edad en meses del niño o niña y el catálogo de manifestaciones de los niveles cercanos a su edad, y SHALL devolver solo identificadores de manifestación existentes en el catálogo, cada uno con una cita textual del texto de entrada, más un nivel sugerido entre 1 y 9 y una confianza.

#### Scenario: Extracción válida
- **WHEN** el texto describe conductas presentes en el catálogo
- **THEN** el borrador contiene identificadores `MAN-…` existentes, cada uno con una cita que aparece en el texto de entrada, y un nivel sugerido entre 1 y 9

#### Scenario: Identificador inexistente
- **WHEN** el modelo devuelve un identificador que no existe en el catálogo o una cita que no aparece en el texto
- **THEN** el sistema descarta ese elemento, reintenta la extracción o marca el borrador como evidencia insuficiente, y no lo guarda como válido

### Requirement: Evidencia insuficiente
Cuando el texto no permita vincular manifestaciones con respaldo, el sistema SHALL marcar el borrador como evidencia insuficiente en lugar de inventar manifestaciones o asignar un nivel.

#### Scenario: Nota sin conductas observables
- **WHEN** la nota solo dice que el niño o niña asistió a la jornada
- **THEN** el borrador queda marcado como evidencia insuficiente y sin nivel sugerido

### Requirement: Lenguaje no diagnóstico
Los textos generados SHALL presentarse como estimación pedagógica sujeta a revisión de la educadora y SHALL NOT afirmar diagnósticos, rezagos confirmados ni equivalencias con la rúbrica institucional.

#### Scenario: Presentación de la sugerencia
- **WHEN** la app muestra un borrador
- **THEN** el nivel aparece rotulado como estimación pedagógica sugerida y no como diagnóstico

### Requirement: Protección de identificadores ante el modelo
El sistema SHALL enviar al modelo solo el texto de la captura, la edad en meses y el catálogo; SHALL NOT enviar nombres, RUT ni identificadores del niño o niña, y SHALL aplicar un filtro de información personal sobre entradas y salidas.

#### Scenario: Llamada al modelo
- **WHEN** el pipeline invoca al modelo
- **THEN** la solicitud no contiene `id_nino`, nombres ni RUT, y se aplica el filtro de información personal configurado

### Requirement: Proveedor de IA intercambiable
El sistema SHALL permitir seleccionar el proveedor de IA por configuración entre `fake` (respuestas deterministas sin llamadas externas) y `bedrock`.

#### Scenario: Desarrollo sin AWS
- **WHEN** `IA_PROVIDER=fake`
- **THEN** el flujo completo de captura a borrador funciona en local sin credenciales de AWS y devuelve un borrador válido según el contrato

### Requirement: Uso de correcciones previas
Cuando el aprendizaje por correcciones esté habilitado, la extracción SHALL incluir como ejemplos correcciones previas similares del mismo jardín, sin identificadores personales, y el borrador SHALL indicar cuántas se usaron.

#### Scenario: Ejemplos disponibles
- **WHEN** existen correcciones similares en el jardín y la función está habilitada
- **THEN** la extracción usa hasta 5 de ellas como ejemplos y el borrador informa cuántas consideró
