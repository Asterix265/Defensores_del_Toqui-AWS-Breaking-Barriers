# Spec Delta

## ADDED Requirements

### Requirement: Texto anonimizado legible
La web SHALL mostrar los marcadores de datos personales del Guardrail (`{NAME}`, `{EMAIL}`, `{PHONE}`, `{ADDRESS}`) como `[nombre]`, `[correo]`, `[teléfono]` y `[dirección]` en la revisión, las citas, el detalle, las tarjetas de notas y la ficha. En una nota escrita, la revisión y el detalle SHALL mostrar el texto original de la educadora.

#### Scenario: Revisión de una nota escrita
- **WHEN** la educadora escribe «Mateo apiló cuatro bloques» y abre la revisión del borrador anonimizado
- **THEN** la revisión muestra «Mateo apiló cuatro bloques» y no muestra `{NAME}`

#### Scenario: Nota de audio en «Por revisar»
- **WHEN** el borrador de un audio tiene el texto «{NAME} logró pararse»
- **THEN** la tarjeta muestra «[nombre] logró pararse»

### Requirement: Salas sin sala propia
Sin sala propia (directora), la pestaña de salas SHALL titularse «Salas», SHALL NOT mostrar «tu sala» y, con «Todas las salas», SHALL pedir elegir una sala en lugar de mostrar el estado de una sala sin indicarlo.

#### Scenario: Directora en «Todas las salas»
- **WHEN** la directora abre «Salas» con «Todas las salas»
- **THEN** ve «Elige una sala para ver su estado por área» y ningún estado por área

#### Scenario: Directora elige una sala
- **WHEN** la directora elige «Sala A»
- **THEN** ve el estado por área de Sala A sin «(tu sala)»

### Requirement: Confirmar el borrado de una nota
«Borrar nota» SHALL pedir confirmación antes de descartar la captura, con una opción para volver a la nota sin borrarla.

#### Scenario: Volver a la nota
- **WHEN** la educadora presiona «Borrar nota» y luego «Volver a la nota»
- **THEN** la revisión sigue abierta y la nota no se descarta

#### Scenario: Borrar
- **WHEN** la educadora presiona «Borrar nota» y luego «Borrar»
- **THEN** la nota se descarta y la app vuelve a donde se abrió la nota

### Requirement: Recargar tras actualizar la app
Cuando un service worker nuevo toma el control de una pestaña que ya tenía uno, la web SHALL recargarse una vez para usar la versión nueva.

#### Scenario: Pestaña abierta antes de un despliegue
- **WHEN** la educadora abre la app con una versión anterior en caché y el service worker nuevo se activa
- **THEN** la página se recarga y muestra la versión publicada
