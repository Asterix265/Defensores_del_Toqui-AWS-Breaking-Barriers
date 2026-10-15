## ADDED Requirements

### Requirement: Infraestructura de producción como código
El ambiente de producción SHALL definirse en los stacks CDK `ToquiRed`, `ToquiDatos` y `ToquiApp` en `us-east-1`, desplegarse con un comando y eliminarse por completo con otro.

#### Scenario: Despliegue completo
- **WHEN** una persona del equipo ejecuta el despliegue de producción con credenciales válidas
- **THEN** quedan creados los tres stacks y sus salidas exponen la URL pública de la web y los identificadores de cada servicio

### Requirement: Un solo dominio HTTPS
La web y la API SHALL servirse por la misma distribución de CloudFront con HTTPS: las rutas `/api/*` SHALL llegar a la API sin el prefijo `/api`, y el resto SHALL servir la PWA con enrutamiento de SPA.

#### Scenario: Salud a través de CloudFront
- **WHEN** se consulta `https://<distribución>/api/health`
- **THEN** responde la API desplegada con `status: ok` y la base de datos `up`

#### Scenario: Ruta de la app
- **WHEN** se abre una ruta de la web que no es un archivo
- **THEN** CloudFront entrega `index.html`

### Requirement: Aislamiento de red
Aurora SHALL estar en subredes sin acceso a internet y aceptar conexiones solo desde la API. El ALB SHALL aceptar tráfico solo desde CloudFront.

#### Scenario: Acceso directo al ALB
- **WHEN** alguien intenta conectarse al ALB desde fuera de CloudFront
- **THEN** la conexión es rechazada

### Requirement: Migraciones al arrancar
El contenedor de la API SHALL componer la conexión a partir del secreto de Aurora y aplicar las migraciones versionadas antes de aceptar solicitudes.

#### Scenario: Primer arranque
- **WHEN** la API arranca contra una base vacía
- **THEN** aplica las migraciones y `GET /health` informa la base `up`

### Requirement: Pipeline basado en eventos
Una captura subida bajo `capturas/` en el bucket de producción SHALL iniciar una ejecución de Step Functions que invoque los pasos Lambda del pipeline.

#### Scenario: Captura subida
- **WHEN** se sube un objeto a `capturas/` en el bucket de producción
- **THEN** se crea una ejecución de la máquina de estados que termina correctamente con el paso de ejemplo
