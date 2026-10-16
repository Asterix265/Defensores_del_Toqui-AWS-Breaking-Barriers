## Context

- La API carga el dataset E-1 anterior (`dataset_e1_publico`: 20 jardines, 500 niños, 9 niveles, 5 dominios) con `apps/api/src/seed/dataset.ts`, y genera nombres sintéticos porque ese dataset no los traía.
- Aurora (`toqui-prod`, PostgreSQL 17.9) está en subredes aisladas. Solo la tarea Fargate de la API llega a ella. Las migraciones las aplica el contenedor `migraciones` con el usuario administrador, y la API usa `toqui_app`, que solo tiene permisos DML.
- Según `docs/arquitectura-aws.md`, la carga del dataset en Aurora estaba pendiente.
- El dataset nuevo está en `dataset_e1_nucleos_2026/` (fuera del repositorio). Su diccionario (`diccionario_datos.md`) es la fuente del esquema.

## Goals / Non-Goals

**Goals:**

- Un modelo relacional que conserve las claves, relaciones y estados del dataset nuevo sin inventar equivalencias con la escala anterior.
- Una carga validada e idempotente, igual en local y en Aurora.
- Una API coherente con el modelo, y que la IA, el pipeline y la web sigan compilando y funcionando.

**Non-Goals:**

- Borradores de IA con varios núcleos y un nivel por núcleo.
- Cargar resúmenes y alertas.
- Rediseñar la web.
- Acceso directo a Aurora desde fuera de la VPC (bastión o VPN).

## Decisions

### D1. Modelo Prisma

| Tabla | Clave | Notas |
| --- | --- | --- |
| `nucleos` | `id_nucleo` | `nombre`, `ambito`, `archivo_rubrica`, `origen` |
| `niveles_educativos` | `id_nivel_educativo` | rangos de edad **contextuales** (no son umbrales de logro) |
| `niveles_trayectoria` | `nivel` (1–8) | `nombre_nivel` |
| `versiones_rubrica` | `id_version` | |
| `jardines` | `id_jardin` | + `numero_asistentes`, `id_directora` (sin FK: la directora se inserta después del jardín) |
| `salas` | `id_sala` | FK a jardín, nivel educativo y educadora responsable |
| `educadoras` | `id_educadora` | `nombre_completo`; el enum `rol` pasa a `educadora_parvulos`, `asistente_parvulos` y `directora` |
| `personal_salas` | (`id_educadora`, `id_sala`) | |
| `ninos` | `id_nino` | `nombre_completo`, `nombre_registro`, `id_sala`, `id_nivel_educativo`; se conserva `sala_grupo` |
| `ruta_niveles` (modelo `Descriptor`) | `id_descriptor` | único (`id_version`, `id_nivel_educativo`, `id_nucleo`, `nivel`) |
| `manifestaciones` | `id_manifestacion` | FK a descriptor; `tipo` (`conducta_descriptor` o `ejemplo_ilustrativo`) |
| `observaciones` | `id_observacion` | se elimina `nivel_estimado`; se agregan `texto_observacion`, `contexto`, `apoyos`, `edad_meses_observacion` y `procedencia` (el `origen` del CSV). Se mantiene el enum `origen` (`dataset` o `app`) |
| `observacion_manifestaciones` | `id_evidencia` | `fragmento_evidencia` (nulo solo en la app sin cita) y `alcance` (`componente_observado` o `parcial_otro_descriptor`) |
| `valoraciones` | `id_valoracion` | niño, sala, nivel educativo, núcleo, versión, `fecha_corte`, `nivel_sugerido`, `nivel_validado`, `estado` (6 valores), `id_educadora_decide`, `fecha_decision`, `id_observacion_sin_clasificar`, justificaciones, `paso_siguiente_sugerido`, `origen`, `id_captura` y `id_usuario_decide` (los tres últimos son de la app) |
| `valoracion_evidencias` | (`id_valoracion`, `id_evidencia`) | `uso` (`sustento_propuesta` o `contraste_parcial`) |

Los niveles validados y sugeridos apuntan a `niveles_trayectoria`.

En `valoraciones` no hay restricción única (niño, núcleo, versión, corte): el dataset la cumple, pero la app puede confirmar dos notas del mismo núcleo en un día.

- *Alternativa:* conservar las columnas antiguas y agregar las nuevas. Se descarta porque mezcla dos escalas que el dataset prohíbe convertir.

### D2. Migración destructiva

La migración hace `TRUNCATE` de todas las tablas del dataset y del registro en la app antes de cambiar el esquema. Las capturas, borradores y correcciones apuntan a niños (`NINO-00001`…) y manifestaciones (`MAN-L01-…`) del dataset anterior. Los IDs de niños se repiten, pero corresponden a otros niños, así que conservarlos produciría historias cruzadas.

En Aurora, la migración la aplica el contenedor `migraciones` en el siguiente despliegue, así que hay que avisar al equipo antes.

### D3. Carga

`leerDataset(dir)` valida con zod los 15 CSV que usa la carga, y además comprueba:

- las claves foráneas internas;
- que cada fragmento sea subcadena literal de `texto_observacion`.

Cualquier problema detiene la carga antes de escribir. Los conteos de la v1.0.0 se informan al terminar y se marcan las diferencias. No bloquean la carga, para no rechazar una versión posterior del dataset con el mismo esquema. `cargarDataset` inserta en una transacción con `createMany` (por lotes para respetar el máximo de parámetros de PostgreSQL) y no hace nada si ya hay jardines.

Se elimina `seed/nombres.ts`: el dataset ya trae nombres ficticios.

### D4. Carga en Aurora: tarea ECS única

`pnpm aws:prod:seed --dataset <dir>`:

1. sube los 15 CSV a `s3://toqui-prod-capturas-<cuenta>/dataset/<sha256 corto>/`;
2. lee el servicio `toqui-api` (definición de tarea, subredes y grupo de seguridad);
3. ejecuta `RunTask` con la misma definición y reemplaza el comando del contenedor de la API por `node docker-entrypoint.mjs --cargar-dataset` con `DATASET_S3_URI`;
4. espera a que la tarea termine e informa el código de salida y dónde ver el log.

El entrypoint arma `DATABASE_URL` igual que al arrancar la API y ejecuta `dist/seed/cargar-dataset.js`, que descarga los CSV de `DATASET_S3_URI` a una carpeta temporal (o usa `DATASET_DIR`). El contenedor `migraciones` corre primero, como en cada arranque, y asegura que el esquema esté al día. La carga usa `toqui_app` (solo DML), que alcanza para insertar.

Permisos: el rol de tarea de la API agrega `s3:GetObject` sobre `dataset/*` del bucket de capturas. No hay recursos nuevos. El ciclo de vida del bucket borra el prefijo a los 7 días.

- *Alternativa:* incluir el dataset en la imagen. Se descarta porque los datos quedarían dentro de cada imagen de la API y en ECR.
- *Alternativa:* abrir Aurora a internet o crear un bastión. Se descarta porque contradice `endurecer-seguridad-aws`.

### D5. Contrato de la API

- **`Manifestacion`:** `{ id, idDescriptor, nucleo, nivelEducativo, nivel, tipo, textoObservable }`. `GET /manifestaciones` filtra por `nucleo`, `nivelEducativo` y `nivel`.
- **`GET /nucleos`:** `{ id, nombre, ambito, origen }`.
- **`GET /niveles`:** `{ nivel, nombre }`, 8 filas.
- **`Nino`:** agrega `idSala`, `nivelEducativo` y `nombreCompleto`. `nombres` es la primera palabra de `nombre_completo` y `apellidos` el resto, para no romper la web.
- **Trayectoria:**
  - `nucleos[]` reemplaza a `dominios[]`;
  - cada núcleo trae `sinRegistros` y sus `valoraciones` del periodo (`fechaCorte`, `nivelSugerido`, `nivelValidado`, `estado` y `origen`);
  - las observaciones pierden `nivelEstimado` y ganan `textoObservacion`;
  - sus manifestaciones traen el fragmento y el alcance.
- **`CapturaResumen`:** `nucleos[]` reemplaza a `dominios[]`; `nivel` es el validado de la valoración de la app.
- **`ObservacionConfirmada`:** `nivel` y `nucleos` en lugar de `nivelEstimado`.
- **`NivelSchema`:** pasa a 1–8.

### D6. Confirmación de una nota

Se mantiene la regla de un nivel por nota (las manifestaciones elegidas deben ser de ese nivel) y se agrega que todas deben ser del nivel educativo del niño o niña.

Confirmar crea:

- la observación de la app, con `texto_observacion` igual al texto fuente del borrador;
- una evidencia por manifestación;
- **una valoración por núcleo** presente, con `origen = app`, `fecha_corte = fecha de la captura`, `nivel_validado = nivel elegido` y `nivel_sugerido` igual al nivel del borrador si este proponía ese núcleo (null si no);
- `estado`: `confirmada` si el sugerido coincide con el validado, `ajustada` si no.

Así el registro de la app usa la misma forma que las decisiones del dataset.

### D7. Contexto de la IA

`MensajeCaptura` agrega `nivelEducativo`. El catálogo se limita a ese nivel educativo (192 manifestaciones, unos 40 KB, bajo el límite de 1 MiB de SQS).

`nivelEsperado` cambia de significado: es la mediana redondeada de los últimos niveles validados del niño o niña (1 si no tiene ninguno). El prompt lo presenta como «nivel de referencia (último validado)», no como esperado para la edad.

En `packages/ia` y `apps/pipeline` el campo `dominio` del catálogo pasa a `nucleo`. El proveedor `fake` del pipeline elige el núcleo por palabras clave adaptadas a los 8 núcleos.

### D8. La web parte del nivel 1 sin propuesta

Antes, sin propuesta de la IA, la web proponía el nivel esperado para la edad. Los niveles del dataset por núcleos no tienen edades, así que ahora la elección parte del nivel 1 y el catálogo se filtra por el nivel educativo del niño o niña.

- *Pendiente:* partir del último nivel validado del núcleo, que la trayectoria ya entrega.

## Risks / Trade-offs

- **[Pérdida de datos sintéticos de la app en Aurora]** → avisar al equipo antes del despliegue; la migración lo explica en su comentario.
- **[Choques con trabajo en curso]** → el cambio va en la rama `feat/dataset-nucleos` con PR; los archivos de la web cambian solo en tipos y etiquetas.
- **[Catálogo más largo en el prompt]** → se limita al nivel educativo del niño o niña; el modelo sigue validado contra el catálogo.
- **[La tarea de carga comparte la definición de la API]** → no se registra en el balanceador y termina al acabar la carga; el entrypoint sale con un código distinto de 0 si falla.

## Migration Plan

1. Fusionar el PR y avisar al equipo.
2. `pnpm aws:prod:deploy`: aplica la migración y vacía las tablas.
3. `pnpm aws:prod:seed --dataset <ruta a datos_publicos>`.
4. `pnpm aws:prod:smoke`.

Rollback: volver al commit anterior y redesplegar. Los datos del dataset anterior se pueden recargar con el seed anterior.
