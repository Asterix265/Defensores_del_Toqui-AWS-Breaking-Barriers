## Purpose

Que un cambio del backend llegue a producción solo y en pocos minutos, sin desplegar código viejo ni aplicar sin aviso una migración que borra datos.

## ADDED Requirements

### Requirement: Reemplazo rápido de la tarea de la API
El target group de la API SHALL dar por sana una tarea con 2 chequeos de salud seguidos cada 10 s y SHALL desconectar la tarea anterior en 30 s. El servicio SHALL seguir levantando la tarea nueva antes de detener la anterior, con rollback automático.

#### Scenario: Plantilla del target group
- **WHEN** se sintetiza `ToquiApp`
- **THEN** `ApiTgInterno` tiene `HealthCheckIntervalSeconds` 10, `HealthyThresholdCount` 2 y `deregistration_delay.timeout_seconds` 30, y el servicio mantiene `MinimumHealthyPercent` 100 y el circuit breaker con rollback

### Requirement: Imagen de la API solo con lo que usa
El contexto de la imagen de la API SHALL limitarse a los archivos que copia su `Dockerfile`: los manifiestos de la raíz, `apps/api` y `packages/shared`, sin dependencias instaladas, builds ni archivos `.env`. Un cambio fuera de esos archivos no SHALL cambiar el hash del asset de la imagen.

#### Scenario: Cambio solo en la documentación
- **WHEN** se modifica `README.md` y se sintetiza `ToquiApp`
- **THEN** el hash del asset de la imagen de la API es el mismo

#### Scenario: Cambio en la API
- **WHEN** se modifica un archivo de `apps/api/src` y se sintetiza `ToquiApp`
- **THEN** el hash del asset de la imagen de la API cambia

### Requirement: Lambda sin archivos de builds anteriores
El build del pipeline SHALL borrar su carpeta de salida antes de compilar, de modo que el paquete de la Lambda solo contenga los handlers actuales.

#### Scenario: Build con restos
- **WHEN** `apps/pipeline/dist` contiene un archivo que ya no se genera y se compila el pipeline
- **THEN** ese archivo ya no está en `dist`

### Requirement: Despliegue automático desde main
Cada push a `main` que toque algo más que documentación, OpenSpec, Markdown o la web SHALL ejecutar la CI y, si pasa, desplegar `ToquiRed`, `ToquiDatos` y `ToquiApp` sin aprobación manual, con credenciales temporales de un rol que solo puede asumir la rama `main` del repositorio. Las ejecuciones SHALL ir de a una, sin que una más vieja despliegue después de una más nueva. El workflow SHALL poder desactivarse sin modificar la CI.

#### Scenario: Push con cambios en la API
- **WHEN** se hace push a `main` con un cambio en `apps/api`
- **THEN** corre la CI, se despliega y el smoke de producción termina en verde

#### Scenario: Push solo de documentación
- **WHEN** se hace push a `main` que solo cambia archivos en `docs/` o `*.md`
- **THEN** no se ejecuta el workflow de despliegue

#### Scenario: Dos pushes seguidos
- **WHEN** llega un push mientras otro se está desplegando
- **THEN** el nuevo espera a que termine el anterior y despliega su propio commit

#### Scenario: Otra rama
- **WHEN** un workflow de otra rama pide credenciales del rol de despliegue
- **THEN** AWS rechaza la solicitud

### Requirement: Migraciones destructivas explícitas
Antes de desplegar, el workflow SHALL revisar las migraciones agregadas desde el último despliegue exitoso. Si alguna contiene `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` o `DELETE FROM`, SHALL fallar salvo que un mensaje de commit del rango incluya `[migracion-destructiva]`. Si la revisión no puede determinar el rango, SHALL fallar.

#### Scenario: Migración que borra datos sin marca
- **WHEN** el rango incluye una migración nueva con `TRUNCATE` y ningún commit lleva `[migracion-destructiva]`
- **THEN** el workflow falla antes de desplegar

#### Scenario: Migración que borra datos con marca
- **WHEN** el rango incluye una migración nueva con `DROP COLUMN` y el mensaje de un commit del rango contiene `[migracion-destructiva]`
- **THEN** el workflow continúa con el despliegue

#### Scenario: Base desconocida
- **WHEN** el último commit desplegado no es ancestro del commit actual
- **THEN** el workflow falla antes de desplegar
