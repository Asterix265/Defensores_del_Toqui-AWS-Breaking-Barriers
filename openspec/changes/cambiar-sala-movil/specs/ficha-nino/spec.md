# Spec Delta

## MODIFIED Requirements

### Requirement: Lista de la sala
La app SHALL ofrecer en la barra inferior la pestaña «Mi sala», con la lista de los niños y niñas de la sala elegida. Al abrirla por primera vez, la sala elegida SHALL ser la de la educadora. Cada fila SHALL indicar cuántas áreas no tienen registros en los últimos 30 días y abrir la ficha de ese niño o niña.

#### Scenario: Niño o niña con áreas sin registros
- **WHEN** la educadora abre «Mi sala» y Martina no tiene notas de Motor grueso en los últimos 30 días, pero sí de las otras cuatro áreas
- **THEN** la fila de Martina indica «1 área sin notas»

#### Scenario: Abrir la ficha
- **WHEN** la educadora interactúa con el ícono de Martina en «Mi sala»
- **THEN** se abre la ficha de Martina y la pestaña «Mi sala» queda marcada como activa

#### Scenario: Solo la sala elegida
- **WHEN** la educadora abre «Mi sala» sin haber cambiado de sala
- **THEN** la lista muestra su sala y no incluye niños ni niñas de otras salas

## ADDED Requirements

### Requirement: Cambiar de sala
«Mi sala» SHALL permitir elegir cualquier sala del jardín desde un selector ubicado en el encabezado, que muestra el nombre de la sala elegida, sin agregar filas ni controles al resto de la pantalla. El selector SHALL distinguir la sala de la educadora. La sala elegida SHALL mantenerse al abrir una ficha y volver, y SHALL NOT cambiar a qué niños y niñas ofrece Grabar de la barra inferior.

#### Scenario: Ver otra sala
- **WHEN** la educadora presiona el selector de sala y elige Medio Menor
- **THEN** la lista muestra a Vicente y Florencia, no a Martina, y el selector indica «Medio Menor»

#### Scenario: Identificar la sala propia
- **WHEN** la educadora abre el selector de sala
- **THEN** aparecen las tres salas y Sala Cuna Mayor tiene el rótulo «Tu sala»

#### Scenario: Volver de una ficha de otra sala
- **WHEN** la educadora eligió Medio Menor, abre la ficha de Vicente y presiona volver a «Mi sala»
- **THEN** la lista sigue mostrando Medio Menor

#### Scenario: Grabar desde la ficha de otra sala
- **WHEN** la educadora abre la ficha de Vicente (Medio Menor), presiona su botón de grabar, termina el audio y confirma la revisión
- **THEN** la nota queda asociada a Vicente y la app vuelve a su ficha

#### Scenario: Grabar general tras ver otra sala
- **WHEN** la educadora eligió Medio Menor y presiona Grabar en la barra inferior
- **THEN** tras terminar el audio, la app ofrece elegir entre los niños y niñas de su sala, sin nadie preseleccionado
