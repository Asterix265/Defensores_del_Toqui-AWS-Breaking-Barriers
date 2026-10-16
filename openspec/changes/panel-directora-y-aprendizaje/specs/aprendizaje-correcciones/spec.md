# Spec Delta

## ADDED Requirements

### Requirement: Decisiones previas como ejemplos de la clasificación
Al despachar una captura, la API SHALL incluir hasta 5 decisiones previas (`confirmada` o `corregida`) de educadoras del mismo jardín, sobre niños o niñas del mismo nivel educativo, en los últimos 90 días, con las corregidas primero. Cada ejemplo SHALL llevar solo el texto fuente anonimizado (máximo 400 caracteres), el nivel y los IDs de manifestaciones que confirmó la educadora, todos del catálogo del mensaje. SHALL NOT incluir IDs de niño o niña, captura, usuario ni nombres. El modo inline (proveedor simulado por palabras clave) no usa ejemplos.

#### Scenario: Corrección previa en el mismo jardín
- **WHEN** una tía de JAR-0001 corrigió una propuesta de nivel 4 a nivel 3 y luego se registra otra nota en una sala del mismo nivel educativo
- **THEN** el mensaje de la nueva captura incluye ese caso con nivel 3 y las manifestaciones finales

#### Scenario: Otro jardín
- **WHEN** solo existen correcciones en JAR-0002
- **THEN** el mensaje de una captura de JAR-0001 no trae ejemplos

#### Scenario: Ejemplos desactivados
- **WHEN** la API corre con `EJEMPLOS_CORRECCIONES=0`
- **THEN** los mensajes no traen ejemplos

### Requirement: La Lambda usa los ejemplos del mensaje
La Lambda de proceso SHALL pasar los ejemplos del mensaje al clasificador, ordenados por coincidencia de palabras con la nota actual, y SHALL registrar en `procesamiento` cuántos ejemplos usó. Un mensaje sin ejemplos SHALL procesarse igual que hoy.

#### Scenario: Mensaje con ejemplos
- **WHEN** llega un mensaje con 3 ejemplos
- **THEN** el prompt de Claude incluye la sección «Casos parecidos» con los 3 casos y el borrador registra 3 ejemplos usados

#### Scenario: Mensaje antiguo
- **WHEN** llega un mensaje sin el campo `ejemplos`
- **THEN** se valida y se clasifica sin la sección «Casos parecidos»
