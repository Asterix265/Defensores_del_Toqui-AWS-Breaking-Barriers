## ADDED Requirements

### Requirement: Tiempo de registro instrumentado
El sistema SHALL registrar, por captura, el inicio de la captura, la disponibilidad del borrador y la confirmación, y SHALL calcular el tiempo activo de la educadora y el tiempo total.

#### Scenario: Captura confirmada
- **WHEN** una educadora confirma un borrador
- **THEN** quedan registrados los tiempos de inicio, borrador listo y confirmación de esa captura

### Requirement: Indicador de tiempo frente a la línea base
El sistema SHALL mostrar el tiempo promedio de registro por observación y una proyección semanal, junto con el método de cálculo y la línea base declarada por Integra (4 horas semanales), sin presentarla como resultado medido en terreno.

#### Scenario: Panel de impacto
- **WHEN** se abre el panel de impacto
- **THEN** se ven el tiempo promedio medido en la app, la proyección semanal, el supuesto usado y la línea base rotulada como dato de la presentación

### Requirement: Acuerdo entre IA y educadora
El sistema SHALL registrar la sugerencia de la IA y la decisión final de cada captura, y SHALL calcular el acuerdo de nivel exacto, el acuerdo a ±1 nivel y la coincidencia de manifestaciones, en total y por dominio.

#### Scenario: Cálculo del acuerdo
- **WHEN** existen capturas confirmadas con y sin correcciones
- **THEN** el panel muestra el porcentaje de acuerdo exacto, a ±1 y de manifestaciones coincidentes

### Requirement: Evaluación con el dataset
El sistema SHALL incluir un conjunto de evaluación sintético derivado de observaciones del dataset y sus manifestaciones vinculadas, y un comando que mida cuántas manifestaciones recupera la extracción.

#### Scenario: Ejecución de la evaluación
- **WHEN** se ejecuta el comando de evaluación con el proveedor configurado
- **THEN** se obtiene la precisión y la exhaustividad de manifestaciones y el acuerdo de nivel sobre el conjunto
