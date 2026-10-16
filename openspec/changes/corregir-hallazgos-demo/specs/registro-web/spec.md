# Spec Delta

## ADDED Requirements

### Requirement: Nombres reales en la app
La app SHALL mostrar a la educadora y a la directora el texto original de la nota, con los nombres que escribió o dijo la educadora, en la revisión, las citas, el detalle, las tarjetas de notas y la ficha. El modelo SHALL recibir solo el texto anonimizado. La observación confirmada SHALL guardar el texto y las citas originales. Las notas que solo tienen el texto anonimizado SHALL mostrar los marcadores del Guardrail como `[nombre]`, `[correo]`, `[teléfono]` y `[dirección]`.

#### Scenario: Nota de audio con nombre
- **WHEN** la transcripción dice «Mateo saltó en la rampa» y el Guardrail entrega «{NAME} saltó en la rampa»
- **THEN** la revisión muestra «Mateo saltó en la rampa», con la cita «Mateo saltó en la rampa», y Claude recibió solo «{NAME} saltó en la rampa»

#### Scenario: Confirmar guarda el original
- **WHEN** la educadora confirma esa nota
- **THEN** la observación guarda «Mateo saltó en la rampa» como texto y como cita

#### Scenario: Nota anterior sin original
- **WHEN** una nota guardada antes de este cambio tiene solo «{NAME} logró pararse»
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
