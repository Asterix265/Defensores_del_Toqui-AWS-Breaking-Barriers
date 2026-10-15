## Purpose

Avisar a la educadora, sin que tenga que recargar, cuando la propuesta de su captura está lista o falló, sin exponer datos personales en el canal de aviso.

## ADDED Requirements

### Requirement: Aviso al terminar el procesamiento
Cuando una captura pasa a `borrador_listo` o `error`, el sistema SHALL publicar un aviso que la web de quien registró la captura recibe mientras está abierta.

#### Scenario: Propuesta lista
- **WHEN** la web de la educadora está abierta y su captura pasa a `borrador_listo`
- **THEN** la web recibe el aviso en pocos segundos y muestra la propuesta sin que la educadora recargue

#### Scenario: Procesamiento fallido
- **WHEN** la captura pasa a `error`
- **THEN** la web recibe el aviso y muestra que la nota no se pudo procesar

### Requirement: Aviso sin datos personales
El aviso SHALL contener solo el id de la captura y su nuevo estado. La web SHALL obtener la propuesta desde la API, que aplica autenticación y el filtro por jardín.

#### Scenario: Contenido del aviso
- **WHEN** se publica un aviso
- **THEN** el aviso no incluye texto de la nota, manifestaciones, nombres ni identificadores del niño o niña

#### Scenario: Aviso de otra persona
- **WHEN** una usuaria recibe o fabrica un aviso de una captura que no puede ver
- **THEN** la API le responde 404 al pedir el detalle y la web no muestra contenido

### Requirement: Suscripción autenticada
Solo una usuaria autenticada SHALL poder suscribirse a los avisos.

#### Scenario: Suscripción sin sesión
- **WHEN** un cliente sin token válido intenta suscribirse
- **THEN** la suscripción es rechazada

### Requirement: Consulta de respaldo
Si el aviso no llega, la web SHALL consultar periódicamente el estado de las capturas en `procesando` hasta que cambien.

#### Scenario: Canal de avisos caído
- **WHEN** la conexión de avisos no está disponible y una captura pasa a `borrador_listo`
- **THEN** la web muestra la propuesta en la siguiente consulta, a más tardar en 10 segundos
