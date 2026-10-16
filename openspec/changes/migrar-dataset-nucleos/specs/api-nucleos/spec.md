## ADDED Requirements

### Requirement: Catálogo por núcleo y nivel educativo
La API SHALL exponer los núcleos (`GET /nucleos`), los 8 nombres de nivel (`GET /niveles`) y las manifestaciones con su descriptor, núcleo, nivel educativo, nivel y tipo (`GET /manifestaciones`), filtrables por núcleo, nivel educativo y nivel. Los rangos de edad de los niveles educativos SHALL tratarse como contexto y no como umbrales de logro.

#### Scenario: Manifestaciones de un núcleo
- **WHEN** se consulta `GET /manifestaciones?nucleo=IA&nivelEducativo=SC`
- **THEN** se obtienen las 24 manifestaciones de Identidad y Autonomía en Sala Cuna, cada una con su `idDescriptor` y su nivel de 1 a 8

### Requirement: Trayectoria por núcleo
La trayectoria de un niño o niña SHALL agruparse por núcleo y mostrar, para cada uno, las valoraciones del periodo con su nivel sugerido, su nivel validado y su estado. Un núcleo sin evidencia en el periodo SHALL indicarse como «sin registros», no como nivel bajo. Una valoración sin nivel validado SHALL NOT reemplazarse por la sugerida.

#### Scenario: Valoraciones de un corte
- **WHEN** la educadora consulta la trayectoria de `NINO-00001` entre el 2026-08-01 y el 2026-10-15
- **THEN** cada núcleo muestra sus valoraciones de los cortes 2026-08-14, 2026-09-11 y 2026-10-15 con su estado (por ejemplo, `confirmada` con nivel validado 1)

#### Scenario: Evidencia insuficiente
- **WHEN** una valoración está en `evidencia_insuficiente`
- **THEN** se informa sin nivel sugerido ni validado, y no aparece como un nivel bajo

### Requirement: Confirmación por núcleo
Al confirmar una nota, todas las manifestaciones SHALL ser del nivel elegido y del nivel educativo del niño o niña. La confirmación SHALL crear una valoración de la app por cada núcleo de esas manifestaciones, con el nivel validado por la educadora, el nivel sugerido por el borrador cuando proponía ese núcleo y el estado `confirmada` o `ajustada` según coincidan.

#### Scenario: Confirmación sin cambios
- **WHEN** la educadora confirma tal cual un borrador de nivel 3 con dos manifestaciones de `IA`
- **THEN** se crea una observación de la app, sus dos evidencias y una valoración `IA` en estado `confirmada` con nivel sugerido 3 y validado 3

#### Scenario: Manifestación de otro nivel educativo
- **WHEN** la educadora de una sala `SC` intenta confirmar con una manifestación de `NM`
- **THEN** la API responde 422 y no guarda la decisión

#### Scenario: Confirmación sin borrador
- **WHEN** la educadora confirma a mano una nota de texto cuyo procesamiento falló y que no tiene borrador
- **THEN** la observación de la app queda sin `texto_observacion` ni `nota_breve`, y el texto original sigue solo en la captura, donde la retención lo borra a los 7 días

### Requirement: Contexto de la IA por nivel educativo
El mensaje de procesamiento SHALL incluir el nivel educativo del niño o niña y solo el catálogo de ese nivel educativo. El nivel de referencia SHALL calcularse a partir de los últimos niveles validados, sin datos personales.

#### Scenario: Mensaje de la cola
- **WHEN** se encola una nota de un niño o niña de Nivel Medio
- **THEN** el mensaje trae `nivelEducativo: "NM"`, solo manifestaciones `NM` y ningún `idNino`, nombre ni RUT
