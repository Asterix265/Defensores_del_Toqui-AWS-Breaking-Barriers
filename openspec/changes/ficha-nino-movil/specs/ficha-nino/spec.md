# Spec Delta

## Purpose

Permite que la educadora vea, desde el celular, qué tiene anotado de cada niño o niña de su sala y en qué áreas aún no hay registros recientes, y define a quién se asocia una nota según el botón de grabar que use.

## ADDED Requirements

### Requirement: Lista de la sala
La app SHALL ofrecer en la barra inferior la pestaña «Mi sala», con la lista de los niños y niñas de la sala de la educadora. Cada fila SHALL indicar cuántas áreas no tienen registros en los últimos 30 días y abrir la ficha de ese niño o niña.

#### Scenario: Niño o niña con áreas sin registros
- **WHEN** la educadora abre «Mi sala» y Martina no tiene notas de Motor grueso en los últimos 30 días, pero sí de las otras cuatro áreas
- **THEN** la fila de Martina indica «1 área sin notas»

#### Scenario: Abrir la ficha
- **WHEN** la educadora interactúa con el ícono de Martina en «Mi sala»
- **THEN** se abre la ficha de Martina y la pestaña «Mi sala» queda marcada como activa

#### Scenario: Solo la sala propia
- **WHEN** la educadora abre «Mi sala»
- **THEN** la lista no incluye niños ni niñas de otras salas

### Requirement: Áreas de la ficha
La ficha SHALL mostrar las 5 áreas con la cantidad de notas del niño o niña en los últimos 30 días y la fecha de la última. Las áreas sin notas en ese periodo SHALL ir primero, rotuladas como sugerencia de observación.

#### Scenario: Área con notas
- **WHEN** Martina tiene 4 notas de Lenguaje en los últimos 30 días y la última es de hoy
- **THEN** la tarjeta de Lenguaje muestra 4 y «Última: hoy»

#### Scenario: Área sin notas
- **WHEN** Martina no tiene notas de Motor grueso en los últimos 30 días
- **THEN** Motor grueso aparece antes que las demás áreas, con 0 notas y un texto que invita a observarla

#### Scenario: Nota antigua fuera del periodo
- **WHEN** la única nota de Cognitivo de Martina tiene 40 días
- **THEN** Cognitivo cuenta 0 notas en el periodo y se trata como área sin notas

### Requirement: Sin estimaciones de desarrollo
La ficha SHALL NOT mostrar niveles, comparaciones con lo esperado para la edad ni alertas de rezago. Un área sin notas SHALL presentarse como falta de registro, no como falta de logro.

#### Scenario: Rotulado de un área sin notas
- **WHEN** un área no tiene notas en el periodo
- **THEN** la ficha no muestra un nivel ni la palabra «rezago» o «bajo», solo que no hay notas y una invitación a observar

### Requirement: Últimas notas del niño o niña
La ficha SHALL listar las notas del niño o niña de la más reciente a la más antigua, con texto, área, fecha y educadora. Mostrará las 3 más recientes y permitirá ver el resto.

#### Scenario: Ver todas las notas
- **WHEN** Martina tiene 6 notas y la educadora presiona «Ver las 6»
- **THEN** la ficha muestra las 6 notas en orden de la más reciente a la más antigua

#### Scenario: Niño o niña sin notas
- **WHEN** la educadora abre la ficha de un niño o niña sin notas
- **THEN** la ficha muestra las 5 áreas sin notas y un mensaje que invita a registrar la primera

### Requirement: Grabar desde la ficha
El botón de grabar de la ficha SHALL abrir la grabación de audio con ese niño o niña ya elegido, sin pedir que se elija. Al guardar o cancelar SHALL volver a su ficha.

#### Scenario: Nota para el niño o niña en pantalla
- **WHEN** en la ficha de Martina la educadora presiona el botón de grabar, termina el audio y confirma la revisión
- **THEN** la nota queda asociada a Martina sin haber pasado por la elección de niño o niña, la app vuelve a la ficha de Martina y la nota aparece entre sus últimas notas

#### Scenario: Cancelar desde la ficha
- **WHEN** la educadora cancela una grabación iniciada desde la ficha de Martina
- **THEN** la app vuelve a la ficha de Martina sin guardar nada

### Requirement: Grabar general desde la barra inferior
El botón Grabar de la barra inferior SHALL abrir siempre el modo general, que pide elegir al niño o niña después de capturar, sin heredar al niño o niña de la pantalla en curso.

#### Scenario: Grabar general con una ficha abierta
- **WHEN** la educadora está en la ficha de Martina y presiona Grabar en la barra inferior
- **THEN** se abre la grabación general y, tras terminar el audio, la app pide elegir al niño o niña, sin nadie preseleccionado

#### Scenario: Volver a la app tras bloquear el celular
- **WHEN** la educadora dejó abierta la ficha de Martina, bloquea el celular, lo desbloquea mientras cuida a Tomás y presiona Grabar en la barra inferior
- **THEN** puede registrar la nota para Tomás sin pasar por la ficha de Martina y sin que la nota quede a nombre de Martina
