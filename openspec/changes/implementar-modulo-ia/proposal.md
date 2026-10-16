## Why

El pipeline de captura necesita un módulo de IA que convierta una nota (escrita, transcrita o leída de una foto) en un borrador con manifestaciones citadas, y hoy no existe: `main` ya tiene la cola SQS y la Lambda `proceso` (`apps/pipeline`, cambio `cola-ia-y-amplify`) con un clasificador `fake`, y la tarea 4.2 de ese cambio (proveedor `bedrock` con Claude) sigue pendiente. Sin un módulo de IA probado, el pipeline no puede pasar de `fake` a Claude. Se necesita ahora porque el hackatón cierra el 16-10-2026 (decisiones D7 y D8 de `definir-mvp-e1`).

## What Changes

- Nuevo paquete `packages/ia` (`@toqui/ia`): lógica de IA **pura**, sin Nest, Prisma, S3, SQS ni acceso a la API. Recibe texto, edad y catálogo, y devuelve un `BorradorEntrante` del contrato compartido.
- Interfaz `IaProvider` con dos implementaciones seleccionables por configuración: `fake` (determinista, sin AWS) y `bedrock` (Guardrail → Claude con salida estructurada → validación → un reintento → evidencia insuficiente).
- Funciones exportadas: `crearProveedor`, `validar`, `normalizarTexto`, `textoDeTranscripcion`, y los métodos `extraer` y `normalizarFoto` del proveedor.
- **Rúbrica parametrizable**: niveles, núcleos o dominios y su cantidad salen del catálogo recibido, no de constantes del módulo (soporta ruta de 9 niveles × 5 dominios del dataset, y 8 o 9 niveles × 8 a 10 núcleos de la FAQ de Integra).
- **Protección de datos**: el Guardrail se aplica antes de llamar a Claude y falla cerrado; el texto que se devuelve para persistir es el original (no el anonimizado) y las citas se validan contra él.
- Errores tipados (`ErrorIa`) para fallas no reintentables; las fallas transitorias del SDK de Bedrock se propagan con su nombre original para que quien lo use las reintente (en el pipeline, la cola SQS).
- Pruebas unitarias con cliente de Bedrock simulado y una prueba manual opcional contra Bedrock real con el perfil `toqui`.

**Hechos** (verificados en `main`, commit `a31e951`): no existe `packages/ia` ni `IaProvider`; `packages/shared` define `BorradorEntrante` (máximo 5 manifestaciones, `nivelSugerido` 1..9 o `null`), `Manifestacion` y `Dominio` (enum de 5 valores); `crearGuardrail` en `infra/lib/componentes.ts` anonimiza `NAME`, `EMAIL`, `PHONE`, `ADDRESS` y el RUT chileno; la API ya recibe borradores en `POST /interno/capturas/:id/borrador`.

**Supuestos**: la Lambda `proceso` de `apps/pipeline` será el único consumidor, pero todavía no lo usa; la API de Nest sigue con su proveedor `fake` propio. El catálogo lo decide quien llama: en el pipeline es el catálogo completo del mensaje de la cola (sin ventana ±1). Los IDs de modelo vigentes son `us.anthropic.claude-sonnet-5-5` (extracción y foto).

**Decisiones pendientes**: ninguna que bloquee este cambio; ver «Open Questions» en `design.md`: qué `textoFuente` se guarda (el pipeline de `main` guarda el anonimizado y este módulo devuelve el original), forzar la herramienta en Converse y el límite de 9 niveles de `NivelSchema`.

**Exclusiones**: cambios en `apps/api`, `apps/pipeline`, `infra` o `packages/shared`; lectura de S3 o llamadas a la API interna; conectar el módulo a la Lambda `proceso` (adaptador del puerto `Clasificador`, tarea 4.2 de `cola-ia-y-amplify`); un endpoint de contexto (no hace falta: el mensaje de la cola ya lo trae); equivalencia entre los 8 niveles de la rúbrica institucional y los 9 de la ruta sintética (requiere decisión explícita del equipo); embeddings y aprendizaje por correcciones (D10); campo de confianza.

## Capabilities

### New Capabilities

- `modulo-ia`: contrato y comportamiento del módulo `@toqui/ia` — proveedores `fake` y `bedrock`, extracción acotada al catálogo con citas literales, validación, evidencia insuficiente, rúbrica parametrizable, protección de datos personales ante el modelo, normalización de texto, transcripción y foto, y errores tipados.

### Modified Capabilities

(ninguna: `definir-mvp-e1` todavía no está archivado y `openspec/specs/` está vacío, así que no hay requisitos publicados que modificar. Este cambio concreta los requisitos de `extraccion-evidencia-ia` de `definir-mvp-e1`.)

## Impact

- Código nuevo: `packages/ia/` (fuente, pruebas, `package.json`, `tsconfig*.json`). `pnpm-workspace.yaml` ya incluye `packages/*`, no requiere cambios.
- Dependencias nuevas, solo en `packages/ia`: `@aws-sdk/client-bedrock-runtime`; usa `zod` del catálogo del workspace y `@toqui/shared` como dependencia de workspace.
- Documentación: sección de `packages/ia` en el README (comandos verificados) y notas en `definir-mvp-e1/tasks.md` para las tareas 4.3, 4.4 y 4.7.
- Sin cambios de API, de base de datos, de infraestructura ni de contrato OpenAPI (`pnpm contract` no debe generar diferencias).
- Consumidores futuros: la Lambda `proceso` de `apps/pipeline`, mediante un adaptador del puerto `Clasificador`. El bundle de la Lambda debe empaquetar `@toqui/ia`; el SDK de AWS v3 lo provee el runtime y queda como `external` en esbuild.
- **Medición del beneficio**: el módulo no mide horas ahorradas. Se verifica con (a) borradores válidos para el 100 % de los casos de la batería de pruebas, sin IDs ni citas inventadas, y (b) cero llamadas al modelo con `id_nino`, nombre o RUT. El impacto en tiempo de documentación se mide en `definir-mvp-e1` (tarea 6.2) y no se promete aquí.
