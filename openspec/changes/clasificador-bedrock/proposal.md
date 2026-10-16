## Why

La propuesta de nivel y manifestaciones que ve la educadora es **simulada**: la Lambda `toqui-prod-proceso` solo tiene el clasificador `fake` (palabras clave), y `IA_PROVIDER` solo acepta `fake` (`apps/pipeline/src/config.ts`). El módulo `@toqui/ia` (PR #19) ya sabe llamar a Claude en Bedrock con salida estructurada, pero nadie lo usa: la tarea 4.2 de `cola-ia-y-amplify` («clasificación con Claude») sigue pendiente. El desafío E-1 pide que la IA proponga nivel y manifestaciones con evidencia citada, y el cierre de código es el 16-10-2026 a las 10:15.

## What Changes

- **`@toqui/ia` expone `clasificarConClaude`**: la parte que el pipeline necesita (prompt, herramienta, llamada a Converse y normalización de la salida), sin Guardrail, validación ni reintento, que ya hace el orquestador de la Lambda. Devuelve la salida cruda del modelo con la forma que espera `validarClasificacion`.
- **Nuevo `ClasificadorBedrock`** en `apps/pipeline/src/ia/bedrock.ts`, que implementa el puerto `Clasificador` con esa función.
- **`IA_PROVIDER=bedrock`** en la configuración de la Lambda, con la variable `MODELO_EXTRACCION`, y la elección del proveedor en `dependencias.ts`. Con `bedrock`, `LECTOR_FOTO=ia` se rechaza al arrancar (la foto sigue leyéndola Textract).
- **El prompt usa el contexto del puerto**: fragmentos de la base de conocimiento, casos parecidos de la memoria y los problemas del intento anterior, cuando existan (hoy `ContextoVacio` los entrega vacíos).
- **Build y CI**: `@toqui/ia` pasa a ser dependencia de `@toqui/pipeline`, así que se compila antes de los tipos, las pruebas y el empaquetado (CI, `pnpm setup` y `aws:prod:deploy`).
- **Infraestructura**: la Lambda recibe `MODELO_EXTRACCION`, el `IA_PROVIDER` de producción pasa a depender de una constante (**sigue en `fake`** hasta que la prueba en vivo salga bien) y el `timeout` sube de 120 s a 180 s porque la ruta de audio puede esperar 90 s a Transcribe y después llamar a Claude hasta dos veces.
- **Prueba en vivo opcional** contra Bedrock (`RUN_BEDROCK_LIVE=1`), escrita pero **no ejecutada** por quien implementa: la ejecuta quien revisa, con el perfil `toqui` y con aviso por el costo.

**Hechos** (verificados en `main`, commit `03f7f98`): el orquestador (`apps/pipeline/src/orquestador.ts`) ya anonimiza con el Guardrail y falla cerrado, valida con `validarClasificacion` y reintenta una vez pasando `correccion`; el puerto `Clasificador.clasificar(entrada)` devuelve `unknown`; la Lambda ya tiene `bedrock:InvokeModel` y `bedrock:ApplyGuardrail`; `declararProcesamiento` ya rotula como «completado» una clasificación con un proveedor distinto de `fake`; el mensaje de la cola trae el catálogo completo (sin ventana ±1). En el ambiente de desarrollo existen el Guardrail `3iawp1rwi30k` (versión 2) y el modelo `us.anthropic.claude-sonnet-5-5`.

**Supuestos**: el texto que recibe el clasificador ya viene anonimizado y es el `textoFuente` del borrador (decisión del equipo en `cola-ia-y-amplify` D5), así que **no se mapean citas al texto original**. El modelo `us.anthropic.claude-sonnet-5-5` acepta `toolChoice: auto` y rechaza forzar la herramienta; hay que confirmarlo en la prueba en vivo.

**Decisiones pendientes** (no bloquean la implementación): cuándo pasar producción a `bedrock` (después de la prueba en vivo y de dos despliegues: este código y luego el cambio de la constante); si más adelante se lee la foto con Claude (`LECTOR_FOTO=ia`).

**Exclusiones**: `apps/api`, `apps/web` y `packages/shared`; la lectura de fotos con Claude; la memoria y la base de conocimiento (`cola-ia-y-amplify` 8.x); el Guardrail sobre la salida del modelo; el registro de tokens consumidos; el mapeo de citas al texto original (`ProveedorBedrock` sigue existiendo sin cambios); desplegar.

## Capabilities

### New Capabilities

- `clasificacion-bedrock`: clasificación de la nota con Claude en Bedrock dentro de la Lambda de proceso: llamada con herramienta, mensaje sin identificadores, citas normalizadas, reintento con corrección, errores del SDK sin envolver, selección por configuración y activación controlada en producción.

### Modified Capabilities

(ninguna: `openspec/specs/` está vacío; este cambio cumple los requisitos de `extraccion-evidencia-ia` de `definir-mvp-e1` y la tarea 4.2 de `cola-ia-y-amplify`).

## Impact

- Código: `packages/ia/src/` (módulo nuevo y exportaciones), `apps/pipeline/src/` (`ia/bedrock.ts`, `config.ts`, `dependencias.ts` y pruebas), `apps/pipeline/package.json`.
- Build: `package.json` raíz (`setup`, `aws:prod:deploy`), `.github/workflows/ci.yml`, `pnpm-lock.yaml`.
- Infraestructura: `infra/lib/app-stack.ts` (variables de la Lambda, constante `IA_PROVIDER_PROCESO`, `timeout`) y `infra/lib/prod-stacks.test.ts`. **No se despliega** como parte de este cambio.
- Documentación: `README.md`, `docs/arquitectura-aws.md` y notas en `cola-ia-y-amplify/tasks.md` (4.2).
- Servicios AWS: Bedrock Runtime (Converse) en `us-east-1`, con los permisos que la Lambda ya tiene. Sin recursos nuevos ni limpieza adicional.
- **Medición del beneficio**: con `bedrock` activo, una nota de texto, audio o foto llega a la revisión con una propuesta hecha por Claude, con citas verificables, y el aviso «procesamiento simulado» desaparece. Se puede contar cuántas propuestas confirma la educadora sin cambios y cuántas corrige (tarea 6.2 de `definir-mvp-e1`). No se promete la meta institucional de 0 horas.
