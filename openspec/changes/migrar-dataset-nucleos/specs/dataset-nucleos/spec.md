## ADDED Requirements

### Requirement: Modelo del dataset por núcleos
El sistema SHALL almacenar el dataset E1 por núcleos conservando sus claves, relaciones y estados: núcleos, niveles educativos, niveles de trayectoria, versiones de rúbrica, jardines, salas, personal, niños y niñas, descriptores, manifestaciones, observaciones, evidencias, valoraciones y vínculos entre valoración y evidencia. El sistema SHALL NOT almacenar un nivel global por observación ni convertir niveles de la escala anterior.

#### Scenario: Descriptor único
- **WHEN** se carga el descriptor `RUB-E1-2026-01-SC-IA-01`
- **THEN** queda asociado a la versión `E1-2026-01`, al nivel educativo `SC`, al núcleo `IA` y al nivel 1, y no puede existir otro descriptor con esa misma combinación

#### Scenario: Evidencia trazable
- **WHEN** se consulta la evidencia `EVI-0000001`
- **THEN** se obtiene su observación, su manifestación, su fragmento literal y su alcance, y desde la manifestación se llega a su descriptor, núcleo y nivel

### Requirement: Carga validada del dataset
La carga SHALL validar todos los CSV antes de escribir: formato de cada fila, claves foráneas internas y que cada fragmento de evidencia esté literalmente en el texto de su observación. Ante cualquier problema SHALL detenerse sin escribir. Al terminar SHALL informar los conteos y marcar los que difieren de la versión v1.0.0. La carga SHALL ser idempotente: si la base ya tiene jardines, no repite la carga.

#### Scenario: Carga completa en local
- **WHEN** se ejecuta `pnpm db:seed` con `DATASET_DIR` apuntando a `datos_publicos/` de la v1.0.0
- **THEN** se cargan 3 jardines, 18 salas, 57 personas, 252 niños y niñas, 192 descriptores, 576 manifestaciones, 11 400 observaciones, 13 026 evidencias y 5 760 valoraciones

#### Scenario: Fragmento que no está en el texto
- **WHEN** un fragmento de evidencia no aparece literalmente en `texto_observacion`
- **THEN** la carga falla e indica el archivo y el ID de la evidencia, sin escribir en la base

#### Scenario: Segunda ejecución
- **WHEN** se ejecuta la carga sobre una base que ya tiene jardines
- **THEN** informa «sin cambios» y no modifica datos

### Requirement: Migración desde el dataset anterior
La migración SHALL vaciar las tablas del dataset anterior y del registro en la app antes de aplicar el esquema nuevo, porque sus identificadores apuntan a otro dataset.

#### Scenario: Base con datos del dataset anterior
- **WHEN** se aplica la migración sobre una base con el dataset de 9 niveles y capturas sintéticas
- **THEN** las tablas quedan vacías con el esquema nuevo, listas para la carga

### Requirement: Carga en Aurora sin exponer la base
El sistema SHALL permitir cargar el dataset en Aurora de producción con una tarea ECS única dentro de la VPC, que lee los CSV desde un prefijo temporal del bucket de capturas, sin abrir la base a internet ni incluir el dataset en la imagen.

#### Scenario: Carga en producción
- **WHEN** una persona del equipo ejecuta `pnpm aws:prod:seed --dataset <dir>` con el perfil `toqui`
- **THEN** los CSV se suben a `dataset/<huella>/`, una tarea Fargate con la imagen de la API los carga en Aurora con el usuario `toqui_app`, y el comando informa el resultado y el grupo de logs

#### Scenario: Carga fallida
- **WHEN** la validación de la carga falla dentro de la tarea
- **THEN** la tarea termina con un código distinto de 0 y el comando lo informa como error
