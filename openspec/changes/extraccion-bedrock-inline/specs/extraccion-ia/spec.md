# Spec Delta

## Purpose

La IA propone nivel y manifestaciones del catálogo con citas literales a partir de la nota escrita o de la foto del post-it, sin enviar al modelo datos que identifiquen al niño o niña, y el borrador declara qué pasos fueron reales.

## ADDED Requirements

### Requirement: Extracción con Claude y Guardrail
Con `IA_PROVIDER=bedrock`, la API SHALL anonimizar el texto con el Guardrail configurado antes de enviarlo al modelo, y SHALL proponer manifestaciones solo de los niveles esperado ±1 para la edad, todas de un mismo nivel y con una cita que aparezca literalmente en el texto anonimizado. La solicitud al modelo SHALL NOT incluir el id ni el nombre del niño o niña. Si la propuesta no es válida tras un reintento, el borrador SHALL quedar con evidencia insuficiente.

#### Scenario: Nota con un nombre
- **WHEN** la educadora escribe «Hoy Matías apiló cuatro bloques de espuma sin ayuda» y la API usa `bedrock`
- **THEN** el borrador guarda el texto con `{NAME}` en lugar del nombre y propone una manifestación de motor fino citando «apiló cuatro bloques de espuma sin ayuda»

#### Scenario: Propuesta inválida
- **WHEN** Claude propone dos veces un ID que no está en el catálogo
- **THEN** el borrador queda con evidencia insuficiente y sin manifestaciones

### Requirement: Lectura de la foto
Con `IA_PROVIDER=bedrock`, la API SHALL leer la foto JPEG o PNG desde S3 con Claude: SHALL transcribir literalmente el texto escrito o, si no lo hay, describir la actividad sin nombres ni rasgos físicos. La lectura SHALL seguir el mismo camino que una nota escrita.

#### Scenario: Post-it escrito a mano
- **WHEN** la educadora sube la foto de un post-it que dice «Martina apiló 4 bloques sola y aplaudió»
- **THEN** el texto del borrador es la transcripción con `{NAME}` y la propuesta cita «apiló 4 bloques»

#### Scenario: Foto sin texto ni actividad
- **WHEN** la foto no muestra texto ni a un niño o niña haciendo algo
- **THEN** el borrador queda con evidencia insuficiente

### Requirement: Procesamiento declarado según lo ocurrido
El borrador SHALL declarar como `completado` la lectura de la foto y la extracción hechas por Claude, y `simulado` SHALL ser `false` solo si ningún paso fue simulado ni quedó sin implementar. La revisión SHALL rotular el texto como de ejemplo solo cuando la transcripción o la lectura no se completaron.

#### Scenario: Revisión de una foto leída por Claude
- **WHEN** la API termina de procesar una foto con `bedrock`
- **THEN** la revisión muestra «Procesamiento completado», «Lectura de la foto: listo» y el texto rotulado «Lo que se leyó en tu foto»

#### Scenario: Audio con Bedrock en modo inline
- **WHEN** la API procesa un audio con `bedrock` en modo `inline`
- **THEN** la transcripción figura como no implementada, el texto se rotula como de ejemplo y la extracción figura como completada
