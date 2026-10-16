# Spec Delta

## ADDED Requirements

### Requirement: Pestañas del panel de escritorio
En pantallas anchas, la app SHALL mostrar en la cabecera las pestañas «Vista general», «Mi sala» y «Mis notas»; las dos últimas, con los nombres del celular. La pestaña inicial SHALL depender del grupo de quien ingresa: «Vista general» para `directora` y «Mis notas» para `educadora`. «Mis notas» SHALL mostrar la tabla de notas de las salas con el periodo, el reporte y «Nueva nota».

#### Scenario: Vista inicial
- **WHEN** la educadora ingresa desde el PC
- **THEN** la pestaña «Mis notas» está activa y se ve la tabla de notas de las salas

#### Scenario: Vista inicial de la directora
- **WHEN** la directora ingresa desde el PC
- **THEN** la pestaña «Vista general» está activa y se ve el estado de todas las salas del jardín

#### Scenario: Cambiar a Mi sala
- **WHEN** la educadora presiona la pestaña «Mi sala»
- **THEN** se ven las tarjetas de los niños y niñas y la pestaña «Mi sala» queda activa

### Requirement: Filtro de sala en Mi sala y Mis notas
«Mi sala» y «Mis notas» SHALL ofrecer los chips «Todas las salas», «Sala Cuna Mayor», «Sala Cuna Menor» y «Medio Menor». La sala elegida SHALL mantenerse al cambiar de pestaña.

#### Scenario: Filtrar Mi sala
- **WHEN** en «Mi sala» la educadora elige Medio Menor
- **THEN** se ven solo Vicente y Florencia

#### Scenario: Sala compartida entre pestañas
- **WHEN** la educadora elige Medio Menor en «Mi sala» y luego abre «Mis notas»
- **THEN** la tabla muestra solo notas de Medio Menor y el chip Medio Menor está activo

#### Scenario: Todas las salas agrupadas
- **WHEN** en «Mi sala» está elegido «Todas las salas»
- **THEN** las tarjetas se agrupan por sala, cada grupo con el nombre de su sala

### Requirement: Mi sala en escritorio
Cada tarjeta de «Mi sala» SHALL indicar cuántas áreas no tienen notas en los últimos 30 días y abrir la ficha de ese niño o niña. Con niveles registrados, la tarjeta SHALL mostrar el nivel promedio simple (todos los núcleos con nivel pesan igual; los núcleos sin registros no cuentan), rotulado «promedio simple», y SHALL resaltarse «para revisar» con los núcleos en que el niño o niña queda 2 niveles o más bajo la mediana de su sala, con al menos 3 comparables. Cada sala SHALL mostrar sus métricas: niños y niñas, edades, nivel promedio simple, para revisar y sin nivel. Son estimaciones pedagógicas, no diagnósticos: sin registros no hay nivel.

#### Scenario: Áreas sin notas
- **WHEN** Martina no tiene notas de Motor grueso en los últimos 30 días, pero sí de las otras cuatro áreas
- **THEN** su tarjeta indica «1 área sin notas»

#### Scenario: Nivel promedio simple
- **WHEN** las notas de Martina son de nivel 7 y Tomás no tiene registros
- **THEN** la tarjeta de Martina indica «Nivel prom. simple 7» y la de Tomás no muestra nivel

### Requirement: Vista general del jardín
«Vista general» SHALL mostrar una fila por sala con niños y niñas, edades, nivel promedio simple, cuántos quedan para revisar, sin nivel y notas confirmadas de los últimos 7 días. Cada fila SHALL abrir esa sala en «Mi sala».

#### Scenario: Abrir una sala desde la vista general
- **WHEN** la directora presiona «Ver Sala B»
- **THEN** la pestaña «Mi sala» queda activa con Sala B elegida

### Requirement: Descarga CSV sin datos incompletos
«Mi sala» y «Vista general» SHALL ofrecer «Descargar CSV» con lo visible y una columna `nivel_promedio_simple`. Si no se cargó la trayectoria de algún niño o niña, SHALL avisar que los datos están incompletos y ofrecer reintentar, rotular como parciales las métricas de su sala, no calcular su rezago y deshabilitar «Descargar CSV» hasta que todo cargue.

#### Scenario: Trayectoria que no carga
- **WHEN** la trayectoria de Tomás responde con error
- **THEN** se ve «Datos incompletos», Sala A indica «Sin calcular» en «Para revisar» y «Descargar CSV» está deshabilitado; tras reintentar con éxito, el aviso desaparece y la descarga se habilita

### Requirement: Ficha en escritorio
La ficha SHALL mostrar, dentro del panel, las 5 áreas con la cantidad de notas de los últimos 30 días y la fecha de la última, con las áreas sin notas primero como invitación a observar, y las notas del niño o niña de la más reciente a la más antigua (3 visibles y la opción de ver todas). SHALL NOT mostrar niveles, comparaciones con lo esperado para la edad ni alertas de rezago. SHALL mostrar una retroalimentación por área a partir de la nota más reciente de la tía que la registra: lo que anotó, lo que evidencia y un próximo paso de la rúbrica que depende de esa nota; es una sugerencia, no una evaluación. SHALL permitir volver a «Mi sala» con la sala elegida.

#### Scenario: Abrir la ficha
- **WHEN** la educadora presiona la tarjeta de Martina
- **THEN** se ve la ficha de Martina, con Motor grueso como primera área y «Sin notas aún. Buen momento para observar.», y sin la palabra «nivel» ni «rezago»

#### Scenario: Ver todas las notas
- **WHEN** Martina tiene 4 notas y la educadora presiona «Ver las 4»
- **THEN** la ficha muestra las 4 notas

#### Scenario: Volver a Mi sala
- **WHEN** la educadora eligió Medio Menor, abrió la ficha de Vicente y presiona volver a «Mi sala»
- **THEN** se ven las tarjetas de Medio Menor

#### Scenario: Pestaña Mi sala con una ficha abierta
- **WHEN** con la ficha de Martina abierta, la educadora presiona la pestaña «Mi sala»
- **THEN** se vuelve a las tarjetas de los niños y niñas

### Requirement: Nueva nota desde la ficha en escritorio
«Nueva nota» de la ficha SHALL abrir el diálogo de nueva nota con ese niño o niña ya elegido, sin pedir que se elija. «Nueva nota» de la cabecera de cada pestaña SHALL pedir elegir al niño o niña, sin nadie preseleccionado.

#### Scenario: Nota desde la ficha
- **WHEN** en la ficha de Vicente la educadora presiona «Nueva nota para Vicente», elige Escribir, escribe la nota, presiona Listo y confirma la revisión
- **THEN** no pasa por la elección de niño o niña, la nota queda asociada a Vicente y aparece entre sus últimas notas en la ficha

#### Scenario: Nueva nota general
- **WHEN** en «Mi sala» la educadora presiona «Nueva nota» de la cabecera, elige Escribir, escribe y presiona Listo
- **THEN** la app pide elegir al niño o niña, sin nadie preseleccionado
