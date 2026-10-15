# Spec Delta

## Purpose

El pipeline en AWS obtiene de la API lo mínimo para extraer manifestaciones de una captura, sin datos que identifiquen al niño o niña, autenticado con un secreto gestionado en la infraestructura.

## ADDED Requirements

### Requirement: Contexto de la captura para el pipeline
La API SHALL exponer `GET /interno/capturas/:id/contexto`, autorizado con la cabecera `x-pipeline-token`, que devuelve `id`, `formato`, `estado`, `texto`, `edadMeses`, `nivelEsperado` y `catalogo`. El formato `video` SHALL informarse como `audio`. `texto` SHALL ser el texto de la captura cuando el formato es `texto` y `null` en otro caso.

#### Scenario: Captura de texto con edad conocida
- **WHEN** el pipeline pide el contexto de una captura de texto registrada cuando el niño o niña tenía exactamente 20 meses, con el token correcto
- **THEN** recibe 200 con `edadMeses` 20, `nivelEsperado` 7, el texto de la captura y el catálogo de los niveles 6, 7 y 8 ordenado por `id`

#### Scenario: Captura de audio
- **WHEN** el pipeline pide el contexto de una captura de audio
- **THEN** recibe `formato` `audio` y `texto` `null`

#### Scenario: Captura inexistente
- **WHEN** el pipeline pide el contexto de un id que no existe o no es un UUID
- **THEN** recibe 404

### Requirement: Edad y nivel esperado a la fecha de la captura
`edadMeses` SHALL calcularse entre la fecha de nacimiento y la fecha de la captura, con mínimo 0. `nivelEsperado` SHALL ser el nivel cuyo rango `[edadMinMeses, edadMaxMeses)` contiene la edad, o el último nivel si la edad lo supera. El nivel esperado es una referencia de la ruta sintética, no un diagnóstico.

#### Scenario: Edad mayor que la ruta
- **WHEN** la edad a la fecha de la captura supera el rango del último nivel
- **THEN** `nivelEsperado` es el último nivel

### Requirement: Contexto sin datos identificables
La respuesta del contexto SHALL NOT incluir `idNino`, nombres, apellidos, RUT, sala ni jardín, porque se envía a un modelo.

#### Scenario: Respuesta minimizada
- **WHEN** el pipeline recibe el contexto de una captura
- **THEN** la respuesta solo tiene los campos `id`, `formato`, `estado`, `texto`, `edadMeses`, `nivelEsperado` y `catalogo`, y no contiene el id ni el nombre del niño o niña

### Requirement: Autorización con el secreto del pipeline
El contexto SHALL responder 401 sin cabecera o con un token distinto de `PIPELINE_TOKEN`, y 503 si la API no tiene `PIPELINE_TOKEN` configurado. SHALL NOT aceptar el token de Cognito.

#### Scenario: Token inválido
- **WHEN** el pipeline pide el contexto sin cabecera o con un token erróneo
- **THEN** recibe 401

### Requirement: Secreto del pipeline en la infraestructura
La infraestructura SHALL crear el secreto `toqui-prod/pipeline-token` en Secrets Manager con un valor generado de 48 caracteres sin puntuación, SHALL inyectarlo a la tarea de la API como `PIPELINE_TOKEN` y SHALL exponer su ARN como salida del stack. El valor SHALL NOT guardarse en el repositorio.

#### Scenario: Síntesis del stack
- **WHEN** se sintetiza el stack de producción
- **THEN** existe el secreto, la definición de tarea de la API lo recibe como `PIPELINE_TOKEN` y el stack tiene la salida `PipelineTokenSecretArn`
