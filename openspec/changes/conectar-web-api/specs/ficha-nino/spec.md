# Spec Delta

Los niños y niñas, las salas y los registros anteriores pasan a venir de la API (`conectar-web-api`). Se modifican los requisitos que crean `ficha-nino-movil` y `cambiar-sala-movil`.

## MODIFIED Requirements

### Requirement: Lista de la sala
La app SHALL ofrecer en la barra inferior la pestaña «Mi sala», con la lista de los niños y niñas de la sala elegida según la API. Al abrirla por primera vez, la sala elegida SHALL ser la de la educadora; mientras la API no la informe, SHALL ser la primera sala del jardín en orden alfabético de su código, recordada en el navegador. Cada fila SHALL indicar cuántas áreas no tienen registros en los últimos 30 días, contando las observaciones de la API y las notas de la sesión, y abrir la ficha de ese niño o niña. Mientras los registros de un niño o niña cargan, su fila SHALL NOT indicar áreas sin registros.

#### Scenario: Niño o niña con áreas sin registros
- **WHEN** la educadora abre «Mi sala» y la API informa observaciones recientes de Martina en cuatro áreas y ninguna de Motor grueso
- **THEN** la fila de Martina indica «1 área sin notas»

#### Scenario: Abrir la ficha
- **WHEN** la educadora interactúa con el ícono de Martina en «Mi sala»
- **THEN** se abre la ficha de Martina y la pestaña «Mi sala» queda marcada como activa

#### Scenario: Solo la sala elegida
- **WHEN** la educadora abre «Mi sala» sin haber cambiado de sala
- **THEN** la lista muestra la Sala A y no incluye niños ni niñas de otras salas

### Requirement: Cambiar de sala
«Mi sala» SHALL permitir elegir cualquier sala del jardín que informe la API desde un selector ubicado en el encabezado, que muestra el nombre de la sala elegida («Sala A» para el código `SG-A`), sin agregar filas ni controles al resto de la pantalla. El selector SHALL distinguir la sala de la educadora e indicar cuántos niños y niñas tiene cada sala. La sala elegida SHALL mantenerse al abrir una ficha y volver, y SHALL NOT cambiar a qué niños y niñas ofrece Grabar de la barra inferior.

#### Scenario: Ver otra sala
- **WHEN** la educadora presiona el selector de sala y elige la Sala B
- **THEN** la lista muestra a Vicente, no a Martina, y el selector indica «Sala B»

#### Scenario: Identificar la sala propia
- **WHEN** la educadora abre el selector de sala
- **THEN** aparecen las salas del jardín y la Sala A tiene el rótulo «Tu sala»

#### Scenario: Volver de una ficha de otra sala
- **WHEN** la educadora eligió la Sala B, abre la ficha de Vicente y presiona volver a «Mi sala»
- **THEN** la lista sigue mostrando la Sala B

#### Scenario: Grabar desde la ficha de otra sala
- **WHEN** la educadora abre la ficha de Vicente (Sala B), presiona su botón de grabar, termina el audio y confirma la revisión
- **THEN** la nota queda asociada a Vicente y la app vuelve a su ficha

#### Scenario: Grabar general tras ver otra sala
- **WHEN** la educadora eligió la Sala B y presiona Grabar en la barra inferior
- **THEN** tras terminar el audio, la app ofrece elegir entre los niños y niñas de su sala, sin nadie preseleccionado

### Requirement: Áreas de la ficha
La ficha SHALL mostrar las 5 áreas con la cantidad de registros del niño o niña en los últimos 30 días y la fecha del último. Los registros SHALL ser las observaciones que informa la API más las notas guardadas en la sesión; un registro con manifestaciones de varias áreas SHALL contar en cada una. Las áreas sin registros en ese periodo SHALL ir primero, rotuladas como sugerencia de observación.

#### Scenario: Área con registros
- **WHEN** la API informa una observación de Lenguaje de ayer para Martina
- **THEN** la tarjeta de Lenguaje muestra 1 y «Última: ayer»

#### Scenario: Área sin registros
- **WHEN** Martina no tiene registros de Motor grueso en los últimos 30 días
- **THEN** Motor grueso aparece antes que las demás áreas, con 0 y un texto que invita a observarla

#### Scenario: Registro antiguo fuera del periodo
- **WHEN** el único registro de Cognitivo de Martina tiene 40 días
- **THEN** Cognitivo cuenta 0 en el periodo y se trata como área sin registros

#### Scenario: Registro con varias áreas
- **WHEN** una nota de Martina tiene manifestaciones de Lenguaje y de Socioemocional
- **THEN** la nota cuenta en ambas tarjetas

### Requirement: Últimas notas del niño o niña
La ficha SHALL listar los registros del niño o niña de los últimos 3 años, del más reciente al más antiguo: las notas de la sesión con su texto, áreas, fecha y educadora, y las observaciones de la API con sus manifestaciones, la nota breve si la trae, sus áreas, la fecha y el rótulo «Registro del jardín». Mostrará los 3 más recientes y permitirá ver el resto. Mientras cargan, SHALL indicarlo; si la API falla, SHALL avisarlo y mostrar solo las notas de la sesión.

#### Scenario: Ver todos los registros
- **WHEN** Martina tiene 4 registros y la educadora presiona «Ver las 4»
- **THEN** la ficha muestra los 4 registros en orden del más reciente al más antiguo

#### Scenario: Observación del dataset
- **WHEN** la API informa una observación de Martina con nota breve
- **THEN** el registro muestra sus manifestaciones, la nota breve y «Registro del jardín», sin nivel

#### Scenario: Niño o niña sin registros
- **WHEN** la educadora abre la ficha de un niño o niña sin registros en la API ni en la sesión
- **THEN** la ficha muestra las 5 áreas sin registros y un mensaje que invita a registrar la primera nota
