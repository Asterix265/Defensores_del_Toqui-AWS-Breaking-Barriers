# Modelo de datos

Esquema de `apps/api/prisma/schema.prisma`, según `definir-mvp-e1` (D4): las tablas del dataset E-1 (`../diccionario_datos.md`) más las del registro en la app. El dataset se carga con `pnpm db:seed` desde `DATASET_DIR`.

```mermaid
erDiagram
    JARDINES ||--|{ EDUCADORAS : "emplea"
    JARDINES ||--o{ NINOS : "atiende"
    NINOS ||--o{ OBSERVACIONES : "es observado en"
    EDUCADORAS |o--o{ OBSERVACIONES : "registra (dataset)"
    RUTA_NIVELES ||--|{ MANIFESTACIONES : "agrupa"
    RUTA_NIVELES ||--o{ OBSERVACIONES : "nivel_estimado"
    OBSERVACIONES ||--|{ OBSERVACION_MANIFESTACIONES : "evidencia (1 a 5)"
    MANIFESTACIONES ||--o{ OBSERVACION_MANIFESTACIONES : "se vincula en"
    NINOS ||--o{ CAPTURAS : "nota de"
    JARDINES ||--o{ CAPTURAS : "pertenece a"
    CAPTURAS ||--o| BORRADORES : "sugerencia IA (max 1)"
    CAPTURAS ||--o| OBSERVACIONES : "confirmada como"
    CAPTURAS ||--o| CORRECCIONES : "decision"
    CAPTURAS ||--o{ EVENTOS_TIEMPO : "inicio, borrador, decision"

    JARDINES {
        string id_jardin PK "JAR-0001"
        string nombre_fantasia UK
        string comuna
        string region
        int numero_salas
        int numero_educadoras
    }
    EDUCADORAS {
        string id_educadora PK "EDU-0001"
        string id_jardin FK
        string nombres "sintetico"
        string apellidos "sintetico"
        enum rol "educadora_parvulos | tecnico_parvulos"
        int anios_experiencia
    }
    NINOS {
        string id_nino PK "NINO-00001"
        string nombres "sintetico"
        string apellidos "sintetico"
        date fecha_nacimiento
        enum sexo_registrado "f | m | x | no_informado"
        string id_jardin FK
        string sala_grupo
        date fecha_ingreso
    }
    RUTA_NIVELES {
        int nivel PK "1-9"
        string nombre_nivel
        int edad_min_meses
        int edad_max_meses
        enum_array dominios "5, orden canonico"
        string descripcion
    }
    MANIFESTACIONES {
        string id_manifestacion PK "MAN-LNN-DD-NN"
        int nivel FK
        enum dominio
        string texto_observable
    }
    OBSERVACIONES {
        string id_observacion PK "OBS-0000001 o APP-<id_captura>"
        string id_nino FK
        string id_educadora FK "null en la app"
        string id_usuario "sub de Cognito, solo app"
        date fecha_observacion
        enum formato_captura "video | audio | texto | foto"
        int nivel_estimado FK "estimacion, no diagnostico"
        string nota_breve "nullable"
        enum origen "dataset | app"
        uuid id_captura FK,UK "solo app"
    }
    OBSERVACION_MANIFESTACIONES {
        string id_observacion PK,FK
        string id_manifestacion PK,FK
        string cita "nullable, solo app"
    }
    CAPTURAS {
        uuid id_captura PK
        string id_nino FK
        string id_jardin FK "copia para filtrar"
        string id_usuario "sub de Cognito"
        string autor "nombre o correo del token"
        enum formato
        string texto "nullable, nota escrita"
        string archivo_clave "capturas/<id>.<ext>"
        string archivo_tipo
        enum estado "procesando | borrador_listo | confirmada | descartada | error"
        string error_detalle
        date fecha "dia en America/Santiago"
    }
    BORRADORES {
        uuid id PK
        uuid id_captura FK,UK
        string texto_fuente "del que salen las citas"
        int nivel_sugerido "null si evidencia insuficiente"
        json manifestaciones "[{idManifestacion, cita}]"
        boolean evidencia_insuficiente
        string proveedor "fake | bedrock"
        string modelo
    }
    CORRECCIONES {
        uuid id PK
        uuid id_captura FK,UK
        string id_usuario
        enum decision "confirmada | corregida | descartada"
        json sugerencia "{nivel, manifestaciones}"
        json final "null si se descarto"
    }
    EVENTOS_TIEMPO {
        uuid id PK
        uuid id_captura FK
        enum tipo "inicio | borrador_listo | confirmacion | descarte"
        datetime ocurrio_en
    }
```

## Flujo de una captura

`procesando` → `borrador_listo` → `confirmada` | `descartada`, y `error` si el pipeline falla.

1. `POST /capturas` crea la captura y el evento `inicio`. Audio y foto reciben un PUT firmado; en modo `aws` el texto se guarda en S3 como `.txt`.
2. El pipeline (o el modo `inline` con el proveedor `fake`) entrega el borrador por `POST /interno/capturas/:id/borrador`. Es idempotente: un solo borrador por captura.
3. La educadora que registró confirma (con o sin cambios) o descarta. Confirmar crea la observación `origen = app` con sus citas. En ambos casos queda una fila en `correcciones` con la sugerencia y la decisión.

## Reglas

- Cada observación tiene 1 a 5 manifestaciones **del mismo nivel** que su `nivel_estimado`; la API lo exige al confirmar y al recibir el borrador.
- Toda cita del borrador debe aparecer literalmente en `texto_fuente`.
- La educadora de una observación del dataset y el niño o niña pertenecen al mismo jardín (verificado en las 2 950 observaciones).
- Edad en meses: `12*(año_obs-año_nac)+(mes_obs-mes_nac)-1[día_obs<día_nac]`.
- Nombres de niños, niñas y educadoras: sintéticos y deterministas (`apps/api/src/seed/nombres.ts`). Son datos personales en un sistema real: no se envían al modelo de IA.

## Pendiente

- Embeddings en pgvector (D10, opcional): requiere la imagen `pgvector/pgvector:pg17` en local.
- `usuarios` no existe: la identidad sale del token y cada captura guarda `id_usuario` y `autor`.

## Volumen del dataset

| Tabla | Filas |
| --- | --- |
| jardines | 20 |
| educadoras | 80 |
| ninos | 500 |
| ruta_niveles | 9 |
| manifestaciones | 90 |
| observaciones | 2 950 |
| observacion_manifestaciones | 8 850 |
