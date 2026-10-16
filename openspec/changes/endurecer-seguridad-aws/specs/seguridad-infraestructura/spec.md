## Purpose

Proteger el tránsito y el acceso a los datos de las capturas en producción: una sola entrada pública cifrada, permisos mínimos para la API y una base de datos a la que la API no puede cambiarle la estructura.

## ADDED Requirements

### Requirement: Entrada única por CloudFront
La API SHALL ser alcanzable desde internet solo a través de CloudFront. El balanceador SHALL ser interno, sin IP pública, y CloudFront SHALL llegar a él por la red de AWS, de modo que los tokens no viajen en claro por internet.

#### Scenario: Acceso directo al balanceador
- **WHEN** alguien intenta conectarse desde internet al nombre DNS del balanceador
- **THEN** la conexión no se establece

#### Scenario: Llamada por la URL pública
- **WHEN** la web en Amplify llama a `/api/health`
- **THEN** responde la API a través de CloudFront

### Requirement: CloudFront solo sirve la API
CloudFront SHALL enrutar todas sus rutas a la API y no SHALL publicar la web. El almacenamiento de capturas SHALL aceptar subidas firmadas solo desde el dominio de la web en Amplify.

#### Scenario: Plantilla sin web en S3
- **WHEN** se sintetiza `ToquiApp`
- **THEN** no existe un bucket web ni un despliegue de archivos web, y la regla CORS de capturas solo lista el dominio de Amplify

### Requirement: Permisos mínimos de la API
El rol de la API SHALL limitarse a leer y escribir objetos bajo `capturas/` y listar el bucket de capturas, enviar a la cola de capturas y leer sus atributos. No SHALL poder borrar objetos, acceder a `transcripciones/` ni invocar modelos de Bedrock.

#### Scenario: Revisión del rol en la plantilla
- **WHEN** se sintetiza `ToquiApp`
- **THEN** la política del rol de la API no contiene `s3:DeleteObject*`, `s3:*` sobre todo el bucket ni acciones `bedrock:*`

#### Scenario: Archivo aún no subido
- **WHEN** la web avisa que terminó una subida que todavía no llega a S3
- **THEN** la API recibe un 404 de S3 y responde 409, no un error interno

### Requirement: Salida acotada de la API
La API SHALL poder salir solo por HTTPS hacia internet y por PostgreSQL hacia Aurora.

#### Scenario: Reglas de salida
- **WHEN** se sintetiza `ToquiApp`
- **THEN** el grupo de seguridad de la API solo tiene salida tcp/443 a `0.0.0.0/0` y tcp/5432 al grupo de Aurora

### Requirement: Usuario de base sin DDL
La API SHALL conectarse a Aurora con un usuario sin permisos para crear, modificar ni borrar tablas. Las migraciones SHALL aplicarse con el usuario administrador en un paso previo que termina antes de que arranque la API, y el usuario de la aplicación SHALL crearse sin pasos manuales.

#### Scenario: Primer despliegue
- **WHEN** se despliega `ToquiApp` en una base sin `toqui_app`
- **THEN** el contenedor de migraciones aplica las migraciones, crea `toqui_app` y la API arranca con ese usuario

#### Scenario: Intento de DDL desde la API
- **WHEN** el usuario de la aplicación intenta `DROP TABLE capturas`
- **THEN** PostgreSQL lo rechaza por falta de permisos

#### Scenario: Credenciales del administrador
- **WHEN** se revisa la definición de la tarea
- **THEN** solo el contenedor de migraciones recibe el secreto del administrador
