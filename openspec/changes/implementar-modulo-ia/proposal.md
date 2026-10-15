## Why

El pipeline de captura necesita un módulo de IA que convierta una nota (escrita, transcrita o leída de una foto) en un borrador con manifestaciones citadas, y hoy no existe: en `main` solo hay un proveedor `fake` embebido en la API (`apps/api/src/pipeline/ia-fake.ts`) y un handler de ejemplo (`apps/pipeline/src/handlers/eco.ts`). Sin ese módulo, la Persona C no puede construir la Lambda orquestadora ni probar el flujo con Bedrock. Se necesita ahora porque el hackatón cierra el 16-10-2026 y el contrato del módulo bloquea a las demás personas (ADR «¿IA en Nest o en Lambda?», decisiones D5, D6 y D8 de `definir-mvp-e1`).

## What Changes

- Nuevo paquete `packages/ia` (`@toqui/ia`): lógica de IA **pura**, sin Nest, Prisma, S3, Step Functions ni acceso a la API. Recibe texto, edad y catálogo, y devuelve un `BorradorEntrante` del contrato compartido.
- Interfaz `IaProvider` con dos implementaciones seleccionables por configuración: `fake` (determinista, sin AWS) y `bedrock` (Guardrail → Claude con salida estructurada → validación → un reintento → evidencia insuficiente).
- Funciones exportadas: `crearProveedor`, `validar`, `normalizarTexto`, `textoDeTranscripcion`, y los métodos `extraer` y `normalizarFoto` del proveedor.
- **Rúbrica parametrizable**: niveles, núcleos o dominios y su cantidad salen del catálogo recibido, no de constantes del módulo (soporta ruta de 9 niveles × 5 dominios del dataset, y 8 o 9 niveles × 8 a 10 núcleos de la FAQ de Integra).
- **Protección de datos**: el Guardrail se aplica antes de llamar a Claude y falla cerrado; el texto que se devuelve para persistir es el original (no el anonimizado) y las citas se validan contra él.
- Errores tipados (`ErrorIa`) para fallas no reintentables; las fallas transitorias del SDK de Bedrock se propagan con su nombre original para que Step Functions las reintente.
- Pruebas unitarias con cliente de Bedrock simulado y una prueba manual opcional contra Bedrock real con el perfil `toqui`.

**Hechos** (verificados en `main`, commit `a31e951`): no existe `packages/ia` ni `IaProvider`; `packages/shared` define `BorradorEntrante` (máximo 5 manifestaciones, `nivelSugerido` 1..9 o `null`), `Manifestacion` y `Dominio` (enum de 5 valores); `crearGuardrail` en `infra/lib/componentes.ts` anonimiza `NAME`, `EMAIL`, `PHONE`, `ADDRESS` y el RUT chileno; la API ya recibe borradores en `POST /interno/capturas/:id/borrador`.

**Supuestos**: la Lambda orquestadora (Persona C) es el único consumidor del módulo por ahora; la API de Nest sigue con su proveedor `fake` propio. El catálogo que recibe el módulo ya viene filtrado a los niveles esperado ±1 (lo arma el endpoint de contexto de la Persona B). Los IDs de modelo vigentes son `us.anthropic.claude-sonnet-5-5` (extracción y foto).

**Decisiones pendientes**: ninguna que bloquee; ver «Open Questions» en `design.md` (forzar herramienta en Converse, y límite de 9 niveles de `NivelSchema` si una rúbrica futura lo supera).

**Exclusiones**: cambios en `apps/api`, `apps/pipeline`, `infra` o `packages/shared`; lectura de S3 o llamadas a la API interna; la Lambda `procesar` y la máquina de estados (Persona C); el endpoint `GET /interno/capturas/:id/contexto` y el secreto `PIPELINE_TOKEN` (Persona B); equivalencia entre los 8 niveles de la rúbrica institucional y los 9 de la ruta sintética (requiere decisión explícita del equipo); embeddings y aprendizaje por correcciones (D10); campo de confianza.

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
- Consumidores futuros: la Lambda `procesar` de `apps/pipeline` (Persona C). El bundle de la Lambda debe empaquetar `@toqui/ia`; el SDK de AWS v3 lo provee el runtime y queda como `external` en esbuild.
- **Medición del beneficio**: el módulo no mide horas ahorradas. Se verifica con (a) borradores válidos para el 100 % de los casos de la batería de pruebas, sin IDs ni citas inventadas, y (b) cero llamadas al modelo con `id_nino`, nombre o RUT. El impacto en tiempo de documentación se mide en `definir-mvp-e1` (tarea 6.2) y no se promete aquí.
