## Why

En el desafío E-1, cada nota de la educadora debe convertirse en una propuesta de observación sin que ella espere frente a la pantalla. Hoy el pipeline de producción (S3 → EventBridge → Step Functions → Lambda `eco`) no procesa nada y deja cabos sueltos. Además, el modo `inline` procesa dentro de la API sin un freno ante picos y sin reintentos, y la web se publica a mano junto con la infraestructura. El 15-10-2026 el equipo decidió (Martín) que el procesamiento pase por una cola, que la educadora reciba un aviso cuando la propuesta esté lista, que la IA use memoria y una base de conocimiento, y que la web se publique sola desde GitHub. El cierre de código es el 16-10-2026 a las 10:15.

## What Changes

- **Cola de trabajos:** la API encola cada captura en SQS (con DLQ). Las notas de texto se encolan al crearlas; el audio y la foto, cuando la web confirma que terminó la subida a S3 (endpoint nuevo).
- **Lambda de proceso** fuera de la VPC, activada por la cola. Normaliza (Transcribe para audio, Textract para foto), anonimiza con el Guardrail, consulta la memoria y la base de conocimiento, clasifica con Claude en Bedrock, valida con zod contra el catálogo y entrega el borrador por el endpoint interno que ya existe (`PIPELINE_TOKEN`).
- **Aviso a la web** por AppSync Events cuando la captura pasa a `borrador_listo` o `error`. El aviso no contiene datos personales: la web vuelve a pedir el detalle a la API. Si el aviso no llega, la web consulta el estado de la captura.
- **Memoria de la IA:** cada confirmación o corrección de una educadora se guarda como vector, filtrable por jardín. La extracción usa como ejemplos hasta 5 casos parecidos del mismo jardín.
- **Base de conocimiento vectorial** (Bedrock Knowledge Base sobre S3 Vectors) con el catálogo de manifestaciones y la descripción de dominios y niveles del dataset sintético. Se usa como contexto de la clasificación.
- **Salud de dependencias:** `/health` informa además la conexión con S3 y con SQS.
- **Web en Amplify Hosting** (app `dgsos3g6dvh6h`, conectada a GitHub desde la consola): se compila y publica sola en cada push a `main`. El build está en `amplify.yml` y las reglas y variables en `pnpm aws:prod:amplify`. Una regla de reescritura envía `/api/*` al CloudFront existente (plan B: CORS).
- **BREAKING (infraestructura):**
  - se eliminan EventBridge, Step Functions, la Lambda `eco`, el bucket web, `BucketDeployment` y la función de rutas SPA de CloudFront;
  - el modo `PIPELINE_MODE=aws` se reemplaza por `cola`;
  - la API ya no escribe las notas de texto en S3.
- **Se mantienen:** el modo `inline` con el proveedor `fake` para desarrollo local, y los stacks `ToquiRed`, `ToquiDatos` y `ToquiDev`.
- **Exclusiones:**
  - conectar el resto de la web con la API y el login con Cognito (trabajo de quienes llevan el front, del que depende la demo);
  - despliegue de CDK desde GitHub Actions y protección de la rama `main`;
  - video;
  - incluir la rúbrica institucional (`docs/rubrica-identidad-autonomia.md`) en la base de conocimiento.

## Capabilities

### New Capabilities

- `cola-procesamiento`: encolado de capturas, procesamiento asíncrono con reintentos y cola de errores, entrega idempotente del borrador y verificación de la conexión con almacenamiento y cola.
- `aviso-propuesta`: aviso a la educadora cuando su propuesta está lista o falló, sin datos personales en el aviso y con consulta de respaldo.
- `memoria-conocimiento-ia`: memoria de correcciones por jardín y base de conocimiento vectorial usadas como contexto de la clasificación, sin identificadores personales.
- `publicacion-web`: publicación automática de la web desde `main` con acceso a la API en el mismo dominio.

### Modified Capabilities

Ninguna: `openspec/specs/` está vacío. La extracción (`extraccion-evidencia-ia`) y el registro (`registro-observaciones`) siguen definidos en el cambio `definir-mvp-e1`, que aún no se archiva; este cambio cumple sus requisitos y no los modifica.

## Impact

- **Hechos:**
  - la API ya expone `POST /interno/capturas/:id/borrador` y `/error` con `PIPELINE_TOKEN`;
  - el borrador es único por captura;
  - Fargate tiene salida a internet;
  - Aurora está aislada y las Lambdas fuera de la VPC no llegan a ella.
- **Supuestos:**
  - la cuenta del evento permite SQS, AppSync, Amplify, S3 Vectors y Bedrock Knowledge Bases en `us-east-1`;
  - el acceso a Claude y a Titan Text Embeddings v2 está habilitado;
  - existen los constructos de CDK necesarios en `aws-cdk-lib` 2.273 (se verifica en la tarea 1.1).
- **Decisiones pendientes:**
  - el valor de la concurrencia máxima según las cuotas de Bedrock de la cuenta;
  - si la rúbrica institucional entra en la base de conocimiento.
- **Código:**
  - `infra/lib/app-stack.ts` y `componentes.ts`, más un stack o constructo nuevo para Amplify;
  - `apps/pipeline` (Lambda de proceso);
  - `apps/api`: capturas, salud, cola, memoria y configuración;
  - `packages/shared`: contrato de salud, de subida completa y del mensaje de la cola;
  - `apps/web`: cliente de avisos y un `amplify.yml` en la raíz;
  - scripts `infra/scripts/smoke-prod.ts` y de ingesta de conocimiento.
- **Dependencias nuevas:** `@aws-sdk/client-sqs`, `client-transcribe`, `client-textract`, `client-secrets-manager`, `client-cloudwatch-logs` (smoke), `client-bedrock-runtime`, `client-bedrock-agent-runtime`, `client-bedrock-agent`, `client-s3vectors` y `@smithy/signature-v4` (firma de publicaciones en AppSync).
- **Documentación:** `docs/arquitectura-aws.md`, `README.md` y el diseño de `definir-mvp-e1` (D2, D6 y D10 quedan reemplazadas).
- **Beneficio medible:**
  - tiempo desde el inicio de la captura hasta `borrador_listo` (`eventos_tiempo`);
  - acuerdo IA–educadora con y sin memoria, sobre datos sintéticos.

  No se promete la meta institucional de 0 horas.
