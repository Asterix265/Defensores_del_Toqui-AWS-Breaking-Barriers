# Modelo de datos

Esquema de `apps/api/prisma/schema.prisma`:

- **Tablas del dataset E1 por núcleos** (v1.0.0, cambio `migrar-dataset-nucleos`). Su fuente es `diccionario_datos.md` del dataset.
- **Tablas del registro en la app** (`definir-mvp-e1`, D4).

El dataset se carga con `pnpm db:seed` desde `DATASET_DIR` (en local) o con `pnpm aws:prod:seed` (en Aurora).

```mermaid
erDiagram
    JARDINES ||--|{ SALAS : "tiene"
    JARDINES ||--|{ EDUCADORAS : "emplea"
    SALAS ||--o{ PERSONAL_SALAS : "asigna"
    EDUCADORAS ||--o{ PERSONAL_SALAS : "trabaja en"
    SALAS ||--o{ NINOS : "matricula"
    NIVELES_EDUCATIVOS ||--o{ SALAS : "SC, NM o TR"
    NUCLEOS ||--o{ RUTA_NIVELES : "rubrica de"
    NIVELES_TRAYECTORIA ||--o{ RUTA_NIVELES : "nivel 1-8"
    RUTA_NIVELES ||--|{ MANIFESTACIONES : "conducta y 2 ejemplos"
    NINOS ||--o{ OBSERVACIONES : "es observado en"
    EDUCADORAS |o--o{ OBSERVACIONES : "registra (dataset)"
    OBSERVACIONES ||--o{ OBSERVACION_MANIFESTACIONES : "evidencia (fragmento)"
    MANIFESTACIONES ||--o{ OBSERVACION_MANIFESTACIONES : "se vincula en"
    NINOS ||--o{ VALORACIONES : "por nucleo y corte"
    VALORACIONES ||--o{ VALORACION_EVIDENCIAS : "sustento"
    OBSERVACION_MANIFESTACIONES ||--o{ VALORACION_EVIDENCIAS : "se usa en"
    NINOS ||--o{ CAPTURAS : "nota de"
    CAPTURAS ||--o| BORRADORES : "sugerencia IA (max 1)"
    CAPTURAS ||--o| OBSERVACIONES : "confirmada como"
    CAPTURAS |o--o{ VALORACIONES : "una por nucleo (app)"
    CAPTURAS ||--o| CORRECCIONES : "decision"
    CAPTURAS ||--o{ EVENTOS_TIEMPO : "inicio, borrador, decision"

    SALAS {
        string id_sala PK "JAR-0001-SC-01"
        string id_jardin FK
        string sala_grupo "SC-01"
        string id_nivel_educativo FK
        string id_educadora_responsable FK
    }
    EDUCADORAS {
        string id_educadora PK "EDU-0101, ASI-0102-1, DIR-0001"
        string id_jardin FK
        string nombre_completo "ficticio"
        enum rol "educadora_parvulos | asistente_parvulos | directora"
    }
    NINOS {
        string id_nino PK "NINO-00001"
        string nombre_completo "ficticio"
        string nombre_registro
        date fecha_nacimiento
        string id_sala FK
        string id_nivel_educativo FK
    }
    RUTA_NIVELES {
        string id_descriptor PK "RUB-E1-2026-01-SC-IA-01"
        string id_version FK
        string id_nivel_educativo FK
        string id_nucleo FK
        int nivel FK "1-8, UK con los anteriores"
        string desarrollo_esperado
        string conducta_observable
    }
    MANIFESTACIONES {
        string id_manifestacion PK
        string id_descriptor FK
        enum tipo "conducta_descriptor | ejemplo_ilustrativo"
        string texto_observable
    }
    OBSERVACIONES {
        string id_observacion PK "OBS-0000001 o APP-<id_captura>"
        string id_nino FK
        string id_educadora FK "null en la app"
        date fecha_observacion
        string nota_breve "hasta 280"
        string texto_observacion "registro completo"
        string contexto
        string apoyos
        enum origen "dataset | app"
        uuid id_captura FK,UK "solo app"
    }
    OBSERVACION_MANIFESTACIONES {
        string id_evidencia PK "EVI-0000001 o uuid (app)"
        string id_observacion FK
        string id_manifestacion FK
        string fragmento_evidencia "literal del texto"
        enum alcance "componente_observado | parcial_otro_descriptor"
    }
    VALORACIONES {
        string id_valoracion PK "VAL-0000001 o VAL-APP-<captura>-<nucleo>"
        string id_nino FK
        string id_nucleo FK
        date fecha_corte
        int nivel_sugerido "null sin evidencia"
        int nivel_validado "solo confirmada o ajustada"
        enum estado "6 estados"
        enum origen "dataset | app"
        uuid id_captura FK "solo app, SET NULL"
    }
    BORRADORES {
        uuid id_captura FK,UK
        string texto_fuente "del que salen las citas"
        int nivel_sugerido "null si evidencia insuficiente"
        json manifestaciones "[{idManifestacion, cita}]"
    }
    CORRECCIONES {
        uuid id_captura FK,UK
        enum decision "confirmada | corregida | descartada"
        json sugerencia "{nivel, manifestaciones}"
        json final "null si se descarto"
    }
```

Tablas omitidas en el diagrama:

- **Catálogos:** `nucleos`, `niveles_educativos`, `niveles_trayectoria` y `versiones_rubrica`.
- **Del registro en la app:** `capturas` y `eventos_tiempo`, sin cambios.

Columnas completas en `schema.prisma`.

## Flujo de una captura

`procesando` → `borrador_listo` → `confirmada` | `descartada`, y `error` si el pipeline falla.

1. `POST /capturas` crea la captura y el evento `inicio`. Audio y foto reciben un PUT firmado; en modo `aws` el texto se guarda en S3 como `.txt`.
2. El pipeline (o el modo `inline` con el proveedor `fake`) entrega el borrador por `POST /interno/capturas/:id/borrador`. Es idempotente: un solo borrador por captura.
3. La educadora que registró confirma (con o sin cambios) o descarta. En ambos casos queda una fila en `correcciones` con la sugerencia y la decisión. Confirmar crea:
   - la observación `origen = app`, con el texto fuente y una evidencia por manifestación;
   - **una valoración por núcleo** (`origen = app`, `fecha_corte` igual al día de la captura), con `nivel_sugerido` del borrador si proponía ese núcleo y `nivel_validado` de la educadora. Su estado es `confirmada` si coinciden y `ajustada` si no.

## Reglas

- El nivel (1–8) es una posición **dentro** de un núcleo, un nivel educativo y una versión de rúbrica. No se compara entre núcleos ni se convierte desde la ruta anterior de 9 niveles.
- Una observación no tiene nivel global: el nivel vive en `valoraciones`, por niño o niña, núcleo y fecha de corte.
- Al confirmar y al recibir un borrador, la API exige:
  - 1 a 5 manifestaciones **del mismo nivel**;
  - todas del **nivel educativo del niño o niña**;
  - que cada cita aparezca literalmente en `texto_fuente`.
- `nivel_validado` solo existe en `confirmada` y `ajustada`. Una propuesta pendiente no reemplaza una decisión validada.
- Al borrar una captura se conservan la observación y la valoración confirmadas; su `id_captura` queda en null.
- Los rangos de edad de `niveles_educativos` son contexto de matrícula, no umbrales de logro.
- Edad en meses: `12*(año_obs-año_nac)+(mes_obs-mes_nac)-1[día_obs<día_nac]`.
- Los nombres de niños, niñas y personal son ficticios y vienen del dataset. En un sistema real serían datos personales: no se envían al modelo de IA.

## Pendiente

- Embeddings en pgvector (D10, opcional): requiere la imagen `pgvector/pgvector:pg17` en local.
- `usuarios` no existe: la identidad sale del token y cada captura guarda `id_usuario` y `autor`.

## Volumen del dataset (v1.0.0)

| Tabla | Filas |
| --- | --- |
| niveles_educativos · nucleos · niveles_trayectoria · versiones_rubrica | 3 · 8 · 8 · 1 |
| jardines · salas · educadoras · personal_salas | 3 · 18 · 57 · 54 |
| ninos | 252 |
| ruta_niveles (descriptores) | 192 |
| manifestaciones | 576 |
| observaciones | 11 400 |
| observacion_manifestaciones (evidencias) | 13 026 |
| valoraciones | 5 760 (3 cortes) |
| valoracion_evidencias | 13 026 |

No se cargan `resumen_salas`, `resumen_jardines` ni `alertas`: se pueden recalcular a partir de las valoraciones.
