## 1. Infraestructura

- [x] 1.1 Crear `infra/lib/dev-stack.ts` (bucket, Cognito, Guardrail, salidas) y reemplazar `ToquiBase` en `infra/bin/app.ts`
- [x] 1.2 Pruebas de aserción del stack (bucket privado con ciclo de vida y CORS, pool con grupos y atributo, guardrail con RUT) y `cdk synth` sin errores

## 2. Scripts

- [x] 2.1 Utilidad compartida que lee las salidas de `ToquiDev` con CloudFormation
- [x] 2.2 `pnpm aws:users`: usuarios sintéticos con la contraseña de `TOQUI_DEV_PASSWORD`
- [x] 2.3 `pnpm aws:env`: imprime las variables de entorno para `apps/api/.env`
- [x] 2.4 Generar y versionar el audio sintético de prueba
- [x] 2.5 `pnpm aws:smoke`: STS → S3 prefirmado → Transcribe → Bedrock con Guardrail → Cognito con JWT

## 3. Despliegue y verificación (requiere confirmación)

- [x] 3.1 `cdk bootstrap` en `us-east-1`
- [x] 3.2 `cdk deploy ToquiDev`, `pnpm aws:users` y `pnpm aws:smoke` con los 5 pasos correctos

## 4. Documentación

- [x] 4.1 `docs/guia-aws.md`, `.env.example` y README actualizados
- [x] 4.2 Validar con `openspec validate configurar-aws-dev --strict --no-interactive`
