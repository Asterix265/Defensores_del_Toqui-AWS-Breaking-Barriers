# Tasks

## 1. API

- [ ] 1.1 `ContextoCapturaSchema` y tipo `ContextoCaptura` en `packages/shared/src/registro.ts`
- [ ] 1.2 `CapturasService.contexto(id)`: edad a la fecha de la captura (mínimo 0), nivel esperado, catálogo ±1 ordenado por `id`, 404 si no existe
- [ ] 1.3 `GET /interno/capturas/:id/contexto` en `interno.controller.ts` con `autorizar`, `operationId: obtenerContextoCaptura` y `@ZodResponse`
- [ ] 1.4 Pruebas e2e en `apps/api/test/registro.e2e.spec.ts`: 401 sin token y con token erróneo, 404, caso conocido de 20 meses (nivel 7, catálogo 6–8), audio sin texto, sin `idNino` ni nombre

## 2. Infraestructura

- [ ] 2.1 Secreto `toqui-prod/pipeline-token` en `infra/lib/app-stack.ts`, inyectado como `PIPELINE_TOKEN` y salida `PipelineTokenSecretArn`
- [ ] 2.2 Prueba de síntesis en `infra/lib/prod-stacks.test.ts`

## 3. Contrato y documentación

- [ ] 3.1 `pnpm contract` y versionar `apps/api/openapi.json` y `apps/web/src/api/generated`
- [ ] 3.2 `docs/arquitectura-aws.md`: quitar de «Pendiente» lo resuelto y nombrar la salida del ARN

## 4. Verificación

- [ ] 4.1 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `pnpm contract` sin diferencias
- [ ] 4.2 Prueba de humo tras desplegar: la cabecera `x-pipeline-token` llega por CloudFront

## Workflow follow-up

- Validar con `openspec validate contexto-pipeline-interno --strict --no-interactive`.
- Avisar a la Persona C la forma de la respuesta y la salida `PipelineTokenSecretArn`.
