## 1. Contrato y modelo

- [x] 1.1 En `packages/shared`:
  - `NucleoSchema`, `NivelEducativoSchema` y `NivelSchema` de 1 a 8;
  - `Manifestacion` con descriptor, núcleo, nivel educativo y tipo;
  - `Nino` con sala y nivel educativo;
  - trayectoria por núcleo con valoraciones;
  - `CapturaResumen` y `ObservacionConfirmada` por núcleo;
  - `MensajeCaptura` con `nivelEducativo`.

  Verificar con `pnpm --filter @toqui/shared typecheck` y sus pruebas
- [x] 1.2 Reescribir los modelos del dataset en `schema.prisma` según D1 y crear la migración destructiva (D2). Verificar con `prisma migrate deploy` sobre la base local con el esquema anterior
  - Verificado el 16-10-2026: la migración vacía las filas del esquema anterior y `prisma migrate diff` no muestra diferencias con el esquema.

## 2. Carga

- [x] 2.1 Reescribir `seed/dataset.ts`:
  - validación zod de los 15 CSV;
  - claves foráneas y fragmentos literales;
  - conteos de la v1.0.0;
  - carga transaccional por lotes.

  Eliminar `seed/nombres.ts`. Verificar con `pnpm db:seed` en local y una prueba de la validación
- [x] 2.2 Soporte `--cargar-dataset` en `docker-entrypoint.mjs`: descarga desde `DATASET_S3_URI` y ejecuta la carga. Verificar compilando la imagen y ejecutándola contra el Postgres local con los CSV en un directorio
  - Verificado el 16-10-2026:
    - con carpeta: carga completa y una segunda ejecución sin cambios;
    - con S3: prefijo temporal en el bucket de `ToquiDev`, borrado después;
    - con error: código de salida 1.

## 3. API

- [x] 3.1 Catálogo: `GET /nucleos`, `GET /niveles` y `GET /manifestaciones` con filtros, `Nino` con sala y nivel educativo, trayectoria por núcleo (D5)
- [x] 3.2 Capturas: validación del borrador y confirmación por nivel educativo; valoración por núcleo al confirmar (D6); resumen y detalle por núcleo
- [x] 3.3 Pipeline: mensaje con `nivelEducativo`, catálogo filtrado y nivel de referencia (D7); el `fake` inline elige el núcleo por palabras clave
- [x] 3.4 Actualizar las pruebas e2e de la API al dataset nuevo y regenerar el contrato (`pnpm contract`). Verificar con `pnpm --filter @toqui/api test`

## 4. IA, pipeline y web (adaptación mínima)

- [x] 4.1 `packages/ia`: `nucleo` en el catálogo y «nivel de referencia» en el prompt. Verificar con `pnpm --filter @toqui/ia test`
- [x] 4.2 `apps/pipeline`: el catálogo con `nucleo` y el `fake` por núcleo. Verificar con `pnpm --filter @toqui/pipeline test`
- [x] 4.3 `apps/web`: núcleos en lugar de dominios (tipos, etiquetas y colores) y el catálogo filtrado por el nivel educativo del niño o niña. Verificar con `pnpm --filter @toqui/web test` y `typecheck`

## 5. Infraestructura

- [x] 5.1 Dar al rol de tarea de la API `s3:GetObject` sobre `dataset/*` del bucket de capturas. Verificar con `pnpm --filter @toqui/infra test` y `cdk synth`
- [x] 5.2 Script `pnpm aws:prod:seed --dataset <dir>` (D4). Verificar el armado del comando con una prueba o una ejecución en seco (`--dry-run`)
  - Verificado con `--dry-run` contra la cuenta el 16-10-2026: definición `ToquiAppApiTaskDef…:1`, contenedor `web`, 15 CSV (12,3 MB).
  - Revisión del PR: el script se niega si `ToquiApp` no terminó bien su último despliegue o no expone `PrefijoDataset`, y detiene la tarea si la espera falla. Verificado con `scripts/cargar-dataset-prod.test.ts` y con `--dry-run` contra la cuenta el 16-10-2026 (se niega: `UPDATE_ROLLBACK_COMPLETE`).

## 6. Cierre

- [x] 6.1 Actualizar README, `docs/contexto-desafio.md`, `docs/arquitectura-aws.md`, `openspec/config.yaml` y `AGENTS.md` (8 niveles por núcleo, origen del dataset, carga en Aurora)
- [x] 6.2 `pnpm lint`, `pnpm typecheck`, `pnpm test` y `openspec validate migrar-dataset-nucleos --strict --no-interactive`
  - Verificado el 16-10-2026:
    - lint, formato, tipos, build y `pnpm infra:synth` sin errores;
    - pruebas: API 69, web 80, IA 121, pipeline 30, infra 20 y shared 3;
    - contrato regenerado sin diferencias;
    - `openspec validate` correcto.
  - Tras la revisión del PR (16-10-2026): API 70 e infra 26 pruebas; lint, formato, tipos, `infra:synth` y contrato sin cambios.
- [x] 6.3 Con aviso al equipo: `pnpm aws:prod:deploy`, `pnpm aws:prod:seed` y `pnpm aws:prod:smoke` (fuera de este PR)
  - Hecho el 16-10-2026:
    - el contenedor `migraciones` aplicó `20261016100000_dataset_nucleos`;
    - `pnpm aws:prod:seed` cargó los mismos conteos que en local;
    - `pnpm aws:prod:smoke` dio 5/5, con el paso 5 actualizado al mensaje con `nivelEducativo` y el catálogo por núcleo;
    - una nota de texto creada por la web de Amplify con una educadora sintética llegó a `borrador_listo`.
