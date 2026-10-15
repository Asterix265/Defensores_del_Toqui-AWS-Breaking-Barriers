# Tasks

## 1. Módulo de IA

- [x] 1.1 Crear `packages/ia` con `IaProvider`, `ProveedorFake`, `ProveedorBedrock`, prompt y validación zod, a partir de la rama `feat/pipeline-ia`, con `ContextoExtraccion` propio
- [x] 1.2 Instrucción de la foto para transcribir el post-it o describir la actividad
- [x] 1.3 Pruebas Vitest del paquete (validación, reintento, Guardrail y foto con un cliente falso)

## 2. API

- [x] 2.1 `IA_PROVIDER=bedrock`, `BEDROCK_MODEL_EXTRACCION` y `BEDROCK_GUARDRAIL_*` en la configuración, con prueba
- [x] 2.2 `PipelineInlineService` usa `@toqui/ia`: catálogo ±1, lectura de la foto desde S3 y `procesamiento` con los pasos reales; `procesamiento.ts` reemplaza `ia-fake.ts`
- [x] 2.3 `AlmacenamientoService.descargar`
- [x] 2.4 Compilar `@toqui/ia` en el `Dockerfile`, los scripts raíz, Jest y la CI

## 3. Web

- [x] 3.1 Rotular el texto según los pasos de `procesamiento` («Lo que se leyó en tu foto»), con prueba
- [x] 3.2 Reducir en el navegador las fotos de más de 3,75 MB

## 4. Verificación

- [x] 4.1 Lint, formato, typecheck, pruebas y build
- [x] 4.2 Flujo real contra la base local, el bucket y Bedrock de `ToquiDev`: nota de texto con nombre (anonimizado como `{NAME}`), post-it sintético transcrito y foto sin texto ni actividad (evidencia insuficiente); notas de prueba descartadas
- [ ] 4.3 Recorrer el flujo en el navegador con `IA_PROVIDER=bedrock`

## 5. Documentación

- [x] 5.1 README, `.env.example` y notas de `definir-mvp-e1` (4.3, 4.4 y 4.7)
