## ADDED Requirements

### Requirement: Entorno local sin AWS
El sistema SHALL poder ejecutarse en local con PostgreSQL en Docker, `IA_PROVIDER=fake` y `AUTH_MODE=local`, sin credenciales de AWS.

#### Scenario: Levantar el entorno
- **WHEN** se inicia la base de datos local, se cargan los datos y se ejecuta el comando de desarrollo
- **THEN** la app web y la API quedan disponibles en local y el flujo de captura a confirmación funciona

### Requirement: Carga del dataset sin copiarlo
El script de carga SHALL leer los CSV desde `DATASET_DIR`, cargarlos en PostgreSQL conservando identificadores, fechas y relaciones, y SHALL NOT copiar los archivos del dataset al repositorio.

#### Scenario: Carga completa
- **WHEN** se ejecuta la carga apuntando al dataset público
- **THEN** la base contiene 20 jardines, 80 educadoras, 500 niños y niñas, 9 niveles, 90 manifestaciones, 2.950 observaciones y 8.850 vínculos

#### Scenario: Ruta no configurada
- **WHEN** `DATASET_DIR` no está definida o no contiene los CSV esperados
- **THEN** la carga termina con un error explícito sin modificar la base
