# Spec Delta

## Purpose

La web de registro usa los datos reales del jardín, del catálogo y de los registros anteriores, y la revisión de cada nota trabaja con nivel y manifestaciones.

## ADDED Requirements

### Requirement: Datos del jardín desde la API
La web SHALL obtener de la API los niños y niñas del jardín, el catálogo de manifestaciones y los niveles de la ruta antes de mostrar las pantallas de registro. Si la API no responde, SHALL mostrar un aviso con la opción de reintentar.

#### Scenario: Carga inicial
- **WHEN** la educadora entra a la app y la API responde
- **THEN** ve el inicio, y «¿De quién es?» ofrece los niños y niñas de su sala según la API

#### Scenario: API caída
- **WHEN** la API responde con un error al pedir los niños y niñas
- **THEN** la app muestra «No se pudo conectar con la API» y un botón para reintentar

### Requirement: Propuesta de nivel y manifestaciones
La revisión de una nota SHALL mostrar un nivel estimado, rotulado como estimación pedagógica y no como diagnóstico, y las manifestaciones del catálogo propuestas con la cita del texto que las respalda. La educadora SHALL poder cambiar el nivel, quitar manifestaciones y agregar otras del nivel elegido, hasta 5. Confirmar SHALL requerir al menos una manifestación, y todas SHALL ser del nivel confirmado.

#### Scenario: Propuesta con evidencia
- **WHEN** la educadora escribe «Apiló tres bloques y aplaudió.» para un niño de 20 meses
- **THEN** la revisión propone el nivel 7 y una manifestación de Motor fino del nivel 7 con la cita «Apiló tres bloques y aplaudió.»

#### Scenario: Evidencia insuficiente
- **WHEN** el texto no tiene pistas suficientes
- **THEN** la revisión lo indica, abre el catálogo del nivel y no permite confirmar hasta elegir una manifestación

#### Scenario: Cambio de nivel
- **WHEN** la educadora sube el nivel con manifestaciones ya elegidas
- **THEN** se quitan las manifestaciones del nivel anterior
