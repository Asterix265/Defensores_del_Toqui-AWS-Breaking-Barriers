## Context

Cuenta AWS del evento con SCP propia: en `us-east-1` se permiten Bedrock (Claude Sonnet 5.5, Haiku 5.5 y Nova vía *inference profiles* `us.*`), Transcribe, S3, Cognito, Guardrails y CloudFormation; en `us-east-2` Bedrock fue rechazado. Las 6 personas del equipo están en el grupo IAM `admins` y usan `aws login` con el perfil `toqui`. CDK no está inicializado en la cuenta.

## Goals / Non-Goals

**Goals:** recursos de desarrollo reproducibles y desechables; una verificación de un solo comando; instrucciones para el equipo.

**Non-Goals:** ambiente demo, integración de la API con AWS, roles IAM por componente y usuarios reales.

## Decisions

- **Un stack compartido `ToquiDev`** (no uno por persona): menos recursos y los mismos IDs para todos. Se coordina antes de cada `cdk deploy`.
- **Bucket con nombre derivado de la cuenta** (`toqui-dev-capturas-<cuenta>`), `RemovalPolicy.DESTROY` y `autoDeleteObjects` para que `cdk destroy` lo borre con su contenido.
- **CORS solo para `http://localhost:5173`**, métodos `PUT`, `GET` y `HEAD`.
- **Cognito con `USER_PASSWORD_AUTH` habilitado en el cliente de desarrollo**, además de SRP, para que la prueba de humo inicie sesión sin librerías de SRP. El ambiente demo usará solo SRP.
- **Usuarios con un script de SDK** (`AdminCreateUser` + `AdminSetUserPassword` permanente + grupo), con la contraseña recibida por la variable `TOQUI_DEV_PASSWORD`. Nunca se versiona.
- **Guardrail con versión publicada** (`CfnGuardrailVersion`), con anonimización de PII administrada (nombre, correo, teléfono, dirección) y una regex de RUT.
- **Audio sintético versionado** (WAV mono de 16 kHz, unos 8 segundos), generado con la síntesis de voz de macOS a partir de un texto escrito por el equipo, sin nombres ni personas reales.
- **Los scripts leen las salidas del stack con CloudFormation**, así nadie copia IDs a mano para probar.
- **Modelos por configuración:** `BEDROCK_MODEL_EXTRACCION=us.anthropic.claude-sonnet-5-5` y `BEDROCK_MODEL_RESUMEN=us.anthropic.claude-haiku-5-5`.

## Risks / Trade-offs

- [`autoDeleteObjects` usa una Lambda de CDK; si la SCP bloqueara Lambda, el despliegue falla] → se detecta en el primer `deploy`; alternativa: quitarlo y vaciar el bucket a mano antes de `destroy`.
- [La detección de nombres del Guardrail está pensada para inglés] → la regex de RUT cubre el identificador chileno; además la app nunca envía nombres al modelo.
- [Despliegues simultáneos del stack compartido] → coordinar por el chat del equipo.
- [Credenciales temporales de `aws login` expiradas] → repetir `aws login --profile toqui`.

## Migration Plan

`cdk bootstrap` una vez → `cdk deploy ToquiDev` → `pnpm aws:users` → `pnpm aws:smoke`. Para revertir: `cdk destroy ToquiDev`.
