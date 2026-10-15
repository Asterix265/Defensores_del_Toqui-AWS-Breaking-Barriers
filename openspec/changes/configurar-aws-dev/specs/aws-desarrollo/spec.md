## ADDED Requirements

### Requirement: Recursos de desarrollo como código
La infraestructura de desarrollo SHALL definirse en el stack CDK `ToquiDev` en `us-east-1`, crearse con `cdk deploy` y eliminarse por completo con `cdk destroy`, sin pasos manuales en la consola salvo el acceso de las personas.

#### Scenario: Despliegue
- **WHEN** una persona del equipo con credenciales válidas despliega `ToquiDev`
- **THEN** existen el bucket de capturas, el User Pool con su cliente web y el Guardrail, y el stack expone sus identificadores como salidas

#### Scenario: Limpieza
- **WHEN** se ejecuta `cdk destroy ToquiDev`
- **THEN** se eliminan el bucket con su contenido, el User Pool y el Guardrail

### Requirement: Bucket de capturas privado
El bucket SHALL bloquear todo acceso público, exigir HTTPS, cifrar en reposo, eliminar objetos a los 7 días y permitir subidas con URL prefirmada desde `http://localhost:5173`.

#### Scenario: Subida con URL prefirmada
- **WHEN** se sube un archivo con una URL prefirmada de corta duración
- **THEN** el objeto queda en el bucket y solo puede leerse con credenciales o con otra URL prefirmada

### Requirement: Identidad de prueba
El User Pool SHALL tener login por email sin registro abierto, grupos `educadora` y `directora`, atributo `custom:id_jardin` y un cliente web sin secreto. Un script SHALL crear usuarios sintéticos de prueba sin guardar contraseñas en el repositorio.

#### Scenario: Usuario de prueba
- **WHEN** se ejecuta el script de usuarios con una contraseña entregada por entorno
- **THEN** existen una educadora y una directora sintéticas de `JAR-0001` en su grupo, y pueden iniciar sesión

### Requirement: Guardrail de datos personales
El Guardrail SHALL anonimizar nombres, correos, teléfonos, direcciones y RUT chilenos en las entradas y salidas del modelo.

#### Scenario: Texto con RUT
- **WHEN** se evalúa un texto que contiene un RUT con el Guardrail
- **THEN** el RUT aparece anonimizado en el resultado

### Requirement: Prueba de humo de punta a punta
El comando `pnpm aws:smoke` SHALL verificar en orden la identidad, la subida y lectura en S3, la transcripción de un audio sintético, una llamada a Claude con el Guardrail y el inicio de sesión en Cognito con validación del token, informando el resultado de cada paso.

#### Scenario: Entorno correcto
- **WHEN** el stack está desplegado, existen los usuarios de prueba y las credenciales son válidas
- **THEN** los cinco pasos terminan correctamente

#### Scenario: Paso fallido
- **WHEN** un paso falla, por ejemplo por una SCP del evento
- **THEN** el comando indica qué servicio falló con su mensaje de error y termina con código distinto de cero
