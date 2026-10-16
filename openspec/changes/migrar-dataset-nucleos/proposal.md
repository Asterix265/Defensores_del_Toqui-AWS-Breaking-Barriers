# Proposal

## Why

El 16-10-2026 el equipo recibió el **dataset sintético E1 por núcleos de aprendizaje** (v1.0.0, `dataset_e1_nucleos_2026.zip`). Reemplaza la escala global de 9 niveles y 5 dominios por **8 núcleos** de las Bases Curriculares, con una escala **1–8 dentro de cada núcleo y nivel educativo** (Sala Cuna, Nivel Medio y Transición). Esa escala coincide con la que usa la presentación del desafío E-1, así que deja de ser necesaria la equivalencia entre 8 y 9 niveles que `AGENTS.md` pedía decidir.

El modelo actual de la API (`schema.prisma`, `seed/dataset.ts`) no puede cargar el dataset nuevo: espera `dominio`, `nivel_estimado` en cada observación y niveles definidos por edad. Sin este cambio, la app no puede mostrar a las educadoras la trayectoria por núcleo ni apoyarse en la decisión documentada (sugerido frente a validado) que el dataset ya modela.

## What Changes

- **BREAKING (modelo):** el esquema Prisma adopta el dataset por núcleos:
  - catálogos nuevos: `nucleos`, `niveles_educativos`, `niveles_trayectoria` y `versiones_rubrica`;
  - organización: `salas` y `personal_salas`;
  - rúbrica: `ruta_niveles`, que pasa a contener descriptores (versión × nivel educativo × núcleo × nivel);
  - evidencia: `manifestaciones` ligadas a un descriptor y `observacion_manifestaciones` con `id_evidencia`, fragmento literal y alcance;
  - decisiones: `valoraciones` y `valoracion_evidencias`.

  Se eliminan el enum `dominio`, los rangos de edad por nivel y `observaciones.nivel_estimado`.
- **BREAKING (datos):** la migración vacía las tablas del dataset y del registro en la app (capturas, borradores, correcciones y observaciones de la app), porque sus IDs de niños y manifestaciones apuntan al dataset anterior. Todos esos datos son sintéticos.
- **Carga:** `pnpm db:seed` lee los CSV nuevos (`DATASET_DIR` apunta a `datos_publicos/`), los valida antes de escribir y conserva IDs, fechas, nombres ficticios y relaciones.
- **Carga en Aurora:** el nuevo comando `pnpm aws:prod:seed` sube los CSV al bucket de capturas (prefijo `dataset/`, que se borra a los 7 días) y lanza una tarea ECS única con la imagen de la API, que descarga los CSV y ejecuta la carga dentro de la VPC.
- **BREAKING (API):**
  - las manifestaciones informan `nucleo`, `nivelEducativo`, `idDescriptor` y `tipo` en vez de `dominio`;
  - `GET /niveles` devuelve los 8 nombres de nivel, sin edades;
  - nuevo `GET /nucleos`;
  - la trayectoria se agrupa por núcleo y muestra las valoraciones (sugerido, validado y estado);
  - confirmar una nota crea una valoración por núcleo con la decisión de la educadora.
- **IA, pipeline y web:** solo lo necesario para compilar y seguir funcionando con el contrato nuevo. El mensaje de la cola lleva el nivel educativo y su catálogo; `nivelEsperado` pasa a ser un nivel de referencia (la mediana de los últimos niveles validados). La web cambia «dominios» por núcleos.

**Hechos** (del README y del diccionario del dataset): 3 jardines, 18 salas, 57 personas, 252 niños y niñas, 192 descriptores, 576 manifestaciones, 11 400 observaciones (todas `texto`), 13 026 evidencias, 5 760 valoraciones en 3 fechas de corte y 13 026 vínculos entre valoración y evidencia. Solo Identidad y Autonomía es referencia aportada; los otros 7 núcleos son propuestas sintéticas.

**Supuestos:**

- Los usuarios de Cognito siguen apuntando a `JAR-0001`, que existe en el dataset nuevo.
- En producción no hay datos reales que conservar.

**Decisiones del equipo** (16-10-2026):

- adoptar el dataset nuevo;
- cargar los 8 núcleos;
- alcance: modelo, carga y API, con adaptación mínima de la IA y la web;
- la carga en Aurora se prepara y se ejecuta con aviso previo al equipo.

**Decisiones pendientes:**

- borradores de la IA con varios núcleos y un nivel por núcleo;
- uso de `resumen_salas`, `resumen_jardines` y `alertas` en el panel de impacto;
- rediseño de la web por núcleo.

**Exclusiones:**

- cargar resúmenes y alertas, que se pueden recalcular a partir de las valoraciones;
- cambios en el prompt de la IA más allá del contexto que recibe;
- conversión numérica entre la escala anterior y la nueva (el dataset la prohíbe);
- archivos multimedia.

## Capabilities

### New Capabilities

- `dataset-nucleos`: modelo de datos y carga validada del dataset E1 por núcleos, en local y en Aurora.
- `api-nucleos`: catálogo, trayectoria y confirmación de notas por núcleo y nivel educativo.

### Modified Capabilities

(ninguna archivada; reemplaza la parte de datos de `definir-mvp-e1` y el catálogo del mensaje de `cola-ia-y-amplify`)

## Impact

- **Código:**
  - `apps/api`: Prisma, migración, carga, catálogo, capturas, pipeline inline y despachador;
  - `packages/shared`: contratos;
  - `packages/ia` y `apps/pipeline`: el campo `nucleo` en el catálogo;
  - `apps/web`: núcleos en lugar de dominios;
  - `infra`: permiso de lectura de `dataset/*` para la tarea de la API y el script `aws:prod:seed`.
- **Datos:** la migración es destructiva para los datos sintéticos que ya existen, en local y en Aurora. Hay que avisar al equipo antes de desplegarla.
- **AWS:** sin recursos nuevos. Costo: una tarea Fargate de pocos minutos y unos 13 MB en S3 durante 7 días, es decir, centavos.
- **Medición del beneficio:** la ficha puede mostrar, por núcleo, el último nivel validado y si falta evidencia, sin que la educadora tenga que revisar notas una por una. No se promete reducir horas de documentación.
