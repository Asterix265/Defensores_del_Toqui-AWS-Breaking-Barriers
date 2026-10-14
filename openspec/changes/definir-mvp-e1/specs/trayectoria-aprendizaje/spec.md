## ADDED Requirements

### Requirement: Trayectoria por niño o niña
El sistema SHALL mostrar la trayectoria de un niño o niña como secuencia temporal de observaciones confirmadas y cargadas del dataset, con nivel estimado, dominios con evidencia y acceso a la evidencia de cada punto.

#### Scenario: Consulta de trayectoria
- **WHEN** la educadora abre la trayectoria de `NINO-00004`
- **THEN** ve sus observaciones ordenadas por fecha con nivel, edad en meses, formato y manifestaciones por dominio

#### Scenario: Pocas observaciones
- **WHEN** el niño o niña tiene una o dos observaciones por ingreso reciente
- **THEN** la vista lo indica como evidencia limitada y no infiere tendencia

### Requirement: Ausencia de registro no es ausencia de aprendizaje
El sistema SHALL distinguir explícitamente entre «sin registro» y «no logrado», y SHALL NOT presentar una manifestación no registrada como no alcanzada.

#### Scenario: Dominio sin observaciones
- **WHEN** un dominio no tiene evidencia registrada en el periodo
- **THEN** la vista muestra «sin registros en el periodo» y no un nivel bajo ni una alerta de rezago

### Requirement: Huecos de evidencia del grupo
El sistema SHALL listar, para la sala de la educadora, los niños y niñas sin registros en un dominio durante un periodo configurable (30 días por defecto), como recordatorio de observación.

#### Scenario: Recordatorio de observación
- **WHEN** la educadora abre el panel del grupo
- **THEN** ve qué niños y niñas no tienen registros en cada dominio en los últimos 30 días, rotulado como sugerencia de observación

### Requirement: Resumen del grupo
El sistema SHALL generar un resumen del grupo para un periodo a partir de observaciones confirmadas, citando los identificadores de observación que respaldan cada afirmación.

#### Scenario: Resumen semanal
- **WHEN** la educadora solicita el resumen de la última semana
- **THEN** el sistema genera un texto en lenguaje no diagnóstico en que cada afirmación referencia observaciones confirmadas
