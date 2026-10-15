# Modelo de datos

Dos partes:

1. **Modelo implementado** (`apps/api/prisma/schema.prisma`): lo que usan la Lambda API y la Lambda de proceso según la arquitectura v1.
2. **Dataset E-1** (`../diccionario_datos.md` y `../datos_publicos/*.csv`): aún no se carga en la base.

## 1. Modelo implementado (arquitectura v1)

```mermaid
erDiagram
    USUARIOS ||--o{ OBSERVACIONES : "registra"
    USUARIOS |o--o{ OBSERVACIONES : "valida"
    CRITERIOS |o--o{ OBSERVACIONES : "propuesto por la IA"
    CRITERIOS |o--o{ OBSERVACIONES : "vigente"
    OBSERVACIONES ||--o{ REVISIONES : "historial"
    OBSERVACIONES ||--o{ EJEMPLOS : "memoria (1 por origen)"
    USUARIOS ||--o{ REVISIONES : "decide"
    USUARIOS ||--o{ EJEMPLOS : "decide"
    CRITERIOS ||--o{ REVISIONES : "elegido"
    CRITERIOS ||--o{ EJEMPLOS : "elegido"

    USUARIOS {
        string id PK "sub de Cognito"
        enum rol "registrador | supervisor"
        string nombre "nullable, del token"
        string telefono "nullable, del token"
        datetime creado_en
        datetime actualizado_en
    }
    CRITERIOS {
        string id PK "slug estable"
        string nombre
        string descripcion "nullable"
        int orden
        boolean activo
    }
    OBSERVACIONES {
        uuid id PK
        string usuario_id FK
        enum tipo "texto | audio | foto"
        string texto "nullable, escrito"
        string archivo_clave "nullable, S3 subidas/sub/"
        string archivo_tipo "nullable, MIME"
        string texto_extraido "nullable, proceso"
        enum estado "pendiente ... validada | error"
        string criterio_propuesto_id FK "nullable, proceso"
        float confianza "nullable, proceso"
        string_array opciones "2 si hay duda, proceso"
        string audio_propuesta_clave "nullable, Polly"
        string criterio_id FK "nullable, vigente"
        string error_detalle "nullable"
        date fecha "dia en America/Santiago"
        string validado_por_id FK "nullable"
        datetime validado_en "nullable"
        datetime creado_en
        datetime actualizado_en
    }
    REVISIONES {
        uuid id PK
        uuid observacion_id FK
        string usuario_id FK
        enum origen "registrador | supervisor"
        string criterio_id FK
        boolean coincide_con_propuesta
        datetime creado_en
    }
    EJEMPLOS {
        uuid id PK
        uuid observacion_id FK "unico con origen"
        enum origen "registrador | supervisor"
        string usuario_id FK
        string criterio_id FK
        float peso "1 registrador, 3 supervisor"
        datetime creado_en
        datetime actualizado_en
    }
```

### Quién escribe qué

| Tabla / columnas | Lambda API | Lambda de proceso |
| --- | --- | --- |
| `usuarios` | Crea o actualiza en cada petición autenticada (con caché por contenedor) | Lee |
| `observaciones`: creación, `estado` de revisión y validación, `criterio_id`, `validado_*` | Escribe | Lee |
| `observaciones`: `procesando`, `propuesta`, `error`, `texto_extraido`, `criterio_propuesto_id`, `confianza`, `opciones`, `audio_propuesta_clave` | Lee | Escribe |
| `revisiones` | Agrega una fila por cada confirmación, corrección o validación | — |
| `ejemplos` | Guarda el último criterio por origen | Lee para buscar ejemplos parecidos |
| `criterios` | Lee | Lee |

### Estados de una observación

`pendiente` → `procesando` → `propuesta` → `confirmada` | `corregida` → `validada`, y `error` si el proceso falla.

- El registrador puede revisar desde `propuesta`, `confirmada`, `corregida` o `error`. Si está `validada`, recibe 409.
- El supervisor puede validar desde esos mismos estados y también volver a cambiar una ya validada.
- Con `pendiente` o `procesando` ambos reciben 409: todavía no hay propuesta.

### Pendiente para la Lambda de proceso

- Agregar el vector (`embedding vector(N)`, pgvector) a `observaciones`. La búsqueda de ejemplos une `ejemplos` con `observaciones` por `observacion_id`.
- pgvector exige la imagen `pgvector/pgvector:pg17` en `docker-compose.yml`. Aurora ya lo incluye.
- Cargar la lista fija de `criterios`: todavía no está definida.

## 2. Dataset E-1 (no cargado en la base)

Las columnas marcadas como **propuesta** no vienen del dataset.

```mermaid
erDiagram
    JARDINES ||--|{ EDUCADORAS : "emplea"
    JARDINES ||--o{ NINOS : "atiende"
    NINOS ||--o{ OBSERVACIONES : "es observado en"
    EDUCADORAS ||--o{ OBSERVACIONES : "registra"
    RUTA_NIVELES ||--|{ MANIFESTACIONES : "agrupa"
    RUTA_NIVELES ||--o{ OBSERVACIONES : "nivel_estimado"
    OBSERVACIONES ||--|{ OBSERVACION_MANIFESTACIONES : "evidencia (1 a 5)"
    MANIFESTACIONES ||--o{ OBSERVACION_MANIFESTACIONES : "se vincula en"

    JARDINES {
        string id_jardin PK "JAR-0001"
        string nombre_fantasia "unico, sintetico"
        string comuna
        string region
        int numero_salas "1-12"
        int numero_educadoras ">=1"
    }
    EDUCADORAS {
        string id_educadora PK "EDU-0001"
        string id_jardin FK
        string nombres "propuesta"
        string apellidos "propuesta"
        string rol "educadora_parvulos | tecnico_parvulos"
        int anios_experiencia "0-35"
    }
    NINOS {
        string id_nino PK "NINO-00001"
        string nombres "propuesta"
        string apellidos "propuesta"
        date fecha_nacimiento
        string sexo_registrado "f | m | x | no_informado"
        string id_jardin FK
        string sala_grupo "sala del jardin"
        date fecha_ingreso
    }
    RUTA_NIVELES {
        int nivel PK "1-9"
        string nombre_nivel
        int edad_min_meses "0-36"
        int edad_max_meses "0-36"
        string dominios "5 dominios separados por |"
        string descripcion
    }
    MANIFESTACIONES {
        string id_manifestacion PK "MAN-LNN-DD-NN"
        int nivel FK
        string dominio "motor_grueso | motor_fino | lenguaje_comunicacion | socioemocional | cognitivo"
        string texto_observable
    }
    OBSERVACIONES {
        string id_observacion PK "OBS-0000001"
        string id_nino FK
        string id_educadora FK
        date fecha_observacion "2025-01-01 a 2026-10-13"
        string formato_captura "video | audio | texto | foto"
        int nivel_estimado FK "1-9"
        string nota_breve "nullable, max 280"
    }
    OBSERVACION_MANIFESTACIONES {
        string id_observacion PK,FK
        string id_manifestacion PK,FK
    }
```

### Reglas que el diagrama no muestra

- Cada observación se vincula con 1 a 5 manifestaciones únicas **del mismo nivel** que su `nivel_estimado`.
- La educadora de una observación y el niño/a pertenecen al mismo jardín (verificado en las 2 950 observaciones del dataset).
- `fecha_ingreso` ≤ primera observación del niño/a.
- Edad en meses (derivada, en `consolidado.json`): `12*(año_obs-año_nac)+(mes_obs-mes_nac)-1[día_obs<día_nac]`.

### Propuesta: nombres

- `nombres` y `apellidos` en `educadoras` y `ninos`. El dataset no los trae: el seed debe generarlos sintéticos.
- Los IDs (`NINO-…`, `EDU-…`) siguen siendo la clave; el nombre es solo para mostrar y para que la Lambda de proceso identifique al niño/a mencionado en una captura.
- Son datos personales: no enviarlos al modelo de IA ni a logs más allá de lo necesario para identificar al niño/a.
- Si se cargan estas tablas, `usuarios` puede enlazarse con `educadoras` mediante un `id_educadora` opcional y único.

### Volumen del dataset

| Tabla | Filas |
| --- | --- |
| jardines | 20 |
| educadoras | 80 |
| ninos | 500 |
| ruta_niveles | 9 |
| manifestaciones | 90 |
| observaciones | 2 950 |
| observacion_manifestaciones | 8 850 |
