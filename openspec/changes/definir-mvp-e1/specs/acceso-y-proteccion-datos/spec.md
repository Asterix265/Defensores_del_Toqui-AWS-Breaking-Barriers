## ADDED Requirements

### Requirement: Autenticación
La API SHALL exigir un token JWT válido emitido por el User Pool de Cognito configurado en todos los endpoints, salvo los de salud y documentación, y SHALL validarlo sin estado de sesión en el servidor.

#### Scenario: Token válido
- **WHEN** una solicitud trae un JWT vigente del User Pool configurado
- **THEN** la API la procesa con la identidad, el grupo y el jardín del token

#### Scenario: Sin token o token inválido
- **WHEN** una solicitud no trae token o trae uno vencido o de otro emisor
- **THEN** la API responde 401 sin ejecutar la operación

### Requirement: Roles y aislamiento por jardín
El sistema SHALL autorizar según el grupo (`educadora`, `directora`) y el atributo `custom:id_jardin`; ningún usuario SHALL leer ni escribir datos de niños o niñas de otro jardín.

#### Scenario: Acceso a otro jardín
- **WHEN** una educadora de `JAR-0001` solicita la trayectoria de un niño o niña de `JAR-0002`
- **THEN** la API responde 403

### Requirement: Modo de autenticación local
El sistema SHALL ofrecer `AUTH_MODE=local` con un usuario de desarrollo fijo, y SHALL rechazar el arranque con ese modo fuera del entorno local.

#### Scenario: Arranque en AWS con modo local
- **WHEN** la API arranca en un entorno distinto de local con `AUTH_MODE=local`
- **THEN** la API falla al iniciar con un mensaje explícito

### Requirement: Resguardo de archivos
Los archivos de captura SHALL almacenarse en un bucket privado con cifrado en reposo, acceso solo mediante URLs prefirmadas de corta duración y eliminación automática tras el periodo de retención configurado.

#### Scenario: Acceso directo al bucket
- **WHEN** alguien intenta leer un objeto del bucket sin URL prefirmada
- **THEN** el acceso es denegado

### Requirement: Solo datos sintéticos
El sistema y el repositorio SHALL usar exclusivamente datos sintéticos; SHALL NOT incluir datos personales reales, medios reales de niños o niñas ni credenciales.

#### Scenario: Medios de demostración
- **WHEN** se preparan audios o fotos para la demo
- **THEN** son producidos por el equipo sin niños o niñas reales y quedan documentados como sintéticos
