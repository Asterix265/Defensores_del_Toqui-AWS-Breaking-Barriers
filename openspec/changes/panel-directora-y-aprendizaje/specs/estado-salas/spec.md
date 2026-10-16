# Spec Delta

## ADDED Requirements

### Requirement: Estado por núcleo de una sala
La API SHALL entregar, para una sala del jardín de quien consulta y una fecha de corte (por defecto, hoy), el estado de cada núcleo calculado con la última valoración con nivel validado de cada niño o niña matriculado al corte, con fecha de corte igual o anterior y decisión de hasta 45 días de antigüedad: matriculados, con y sin decisión válida, distribución por nivel, mediana y niveles modales. SHALL NOT usar niveles sugeridos ni promediar niveles. La sala se identifica por su código dentro del jardín del token; un código que no existe en ese jardín SHALL responder 404.

#### Scenario: Sala con decisiones del dataset
- **WHEN** una educadora de JAR-0001 consulta el estado de una de sus salas con corte 2026-10-15
- **THEN** recibe los 8 núcleos con distribución, mediana y cobertura, y ningún nivel sugerido cuenta como decisión

#### Scenario: Niño o niña sin decisión reciente
- **WHEN** la última valoración validada de un niño o niña en un núcleo tiene más de 45 días al corte
- **THEN** cuenta como «sin decisión válida» y no entra en la distribución

#### Scenario: Sala de otro jardín
- **WHEN** una educadora de JAR-0001 pide el estado de un código de sala que solo existe en otro jardín
- **THEN** la API responde 404 y no entrega datos de ese jardín

### Requirement: Alertas relativas para revisar en contexto
La API SHALL marcar una alerta individual cuando el nivel validado de un niño o niña está 2 o más posiciones bajo la mediana de al menos 5 pares válidos de su sala, en el mismo núcleo, sin contarlo en la referencia. Cada alerta SHALL incluir la referencia, la brecha y la cantidad de pares. La web SHALL resaltar a esos niños o niñas en la sala como «Para revisar en contexto», con la acción sugerida de la metodología, y SHALL NOT presentarlas como rezago o diagnóstico.

#### Scenario: Alerta con pares suficientes
- **WHEN** en un núcleo hay 6 pares válidos con mediana 5 y un niño o niña tiene nivel validado 3
- **THEN** ese niño o niña tiene una alerta con referencia 5, brecha 2 y 6 pares, y aparece resaltado en la lista de la sala

#### Scenario: Pares insuficientes
- **WHEN** en un núcleo hay menos de 5 pares válidos
- **THEN** no se genera alerta individual y la web muestra «Sin pares suficientes»

### Requirement: Vista general de la directora
Una persona del grupo `directora` SHALL ver todas las salas de su jardín en una sola pantalla. Por cada sala: nivel educativo, matriculados, edad mínima, máxima y promedio en meses al corte, cobertura de decisiones, cantidad de alertas individuales, alertas de sala y notas de los últimos 30 días. Una alerta de sala SHALL generarse cuando haya al menos 2 salas con información del mismo jardín, nivel educativo y núcleo (contando la evaluada) y la mediana de la sala esté 1,5 o más posiciones bajo la mediana de las otras salas. Las salas de distinto nivel educativo SHALL NOT compararse. El grupo `educadora` SHALL recibir 403 en este resumen.

#### Scenario: Directora abre el jardín
- **WHEN** la directora de JAR-0001 ingresa en PC
- **THEN** ve la pestaña «Jardín» con una tarjeta por cada sala de su jardín y puede abrir el estado detallado de cualquiera

#### Scenario: Educadora pide el resumen
- **WHEN** una educadora llama al resumen del jardín
- **THEN** la API responde 403 y la web no muestra la pestaña «Jardín»

### Requirement: Exportar a CSV
El estado de la sala, la vista general y la tabla de notas SHALL ofrecer «Descargar CSV» con las filas y los filtros visibles. El archivo SHALL usar `;` como separador, UTF-8 con BOM y escapar comillas, separadores y saltos de línea.

#### Scenario: Descargar el estado de una sala
- **WHEN** la educadora presiona «Descargar CSV» en el estado de su sala
- **THEN** se descarga un archivo con una fila por niño o niña y núcleo (nivel validado, fecha de corte y alerta), que se abre en Excel con tildes correctas

#### Scenario: Texto con separador
- **WHEN** una nota exportada contiene `;`, comillas o un salto de línea
- **THEN** la celda queda entre comillas y el archivo conserva el número de columnas

### Requirement: La página se desplaza después de una nota
Al cerrar, guardar o descartar una nota (diálogo de PC o pantalla del celular), la página SHALL volver a desplazarse y el `body` SHALL NOT quedar con `overflow: hidden`.

#### Scenario: Guardar una nota en PC
- **WHEN** la educadora confirma una nota en el diálogo de PC y aparece el aviso «Nota guardada»
- **THEN** puede desplazar la página con la rueda del mouse y el `body` no tiene `overflow: hidden`
