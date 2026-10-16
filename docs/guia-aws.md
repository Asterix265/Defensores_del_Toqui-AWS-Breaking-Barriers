# Guía AWS de desarrollo

Cómo conectarse a los servicios AWS compartidos de desarrollo del equipo. Verificado el 15-10-2026 con `pnpm aws:smoke` (5/5 pasos correctos).

## Qué hay en la cuenta

Cuenta AWS entregada por el evento, región **`us-east-1`**. La organización del evento aplica una *service control policy* (SCP): en `us-east-2` Bedrock está bloqueado; en `us-east-1` funcionan todos los servicios que usamos. Si un comando falla con `explicit deny in a service control policy`, es una restricción del evento, no de IAM.

| Servicio | Uso en desarrollo | Recurso |
| --- | --- | --- |
| IAM | Acceso de las 6 personas | Grupo `admins` |
| Bedrock | Claude para extraer y resumir; Nova para video (opcional) | `us.anthropic.claude-sonnet-5-5`, `us.anthropic.claude-haiku-5-5`, `us.amazon.nova-lite-v1:0` |
| Bedrock Guardrails | Anonimiza nombres, correos, teléfonos, direcciones y RUT en entrada y salida | `toqui-dev-pii` |
| Transcribe | Audio a texto (`es-US`) | Sin recursos propios |
| S3 | Audios y fotos subidos con URL prefirmada | `toqui-dev-capturas-<cuenta>` (privado, borrado a los 7 días, CORS para `http://localhost:5173`) |
| Cognito | Login con grupos `educadora` y `directora` y atributo `custom:id_jardin` | Pool `toqui-dev` y cliente `toqui-dev-web` |

S3, Cognito y el Guardrail los crea el stack CDK `ToquiDev` (`infra/lib/dev-stack.ts`). Postgres, la API y la web siguen corriendo en local. El ambiente de producción (demo) y su arquitectura completa están en [arquitectura AWS](arquitectura-aws.md).

## Primera vez (cada persona)

1. Instalar AWS CLI v2.
2. Iniciar sesión en la consola de AWS con tu usuario IAM y luego, en la terminal:
   ```sh
   aws login --profile toqui
   ```
   Región: `us-east-1`. Las credenciales son temporales: cuando expiren, repetir el comando.
3. Comprobar: `aws sts get-caller-identity --profile toqui`.
4. Copiar `infra/.env.example` a `infra/.env` y poner la contraseña de los usuarios de prueba (se comparte por un canal privado del equipo, nunca en el repo).
5. Probar todo:
   ```sh
   pnpm aws:smoke
   ```
   Debe terminar con «Todo conectado». Revisa identidad, subida a S3, Transcribe, Claude con Guardrail y login en Cognito.
6. Para la API: agregar a `apps/api/.env` la salida de `pnpm aws:env`.

## Ingreso en la web

La web ingresa con correo y contraseña contra el pool `toqui-dev` (flujo SRP con Amplify Auth: la contraseña no viaja) y envía el **ID token** en `Authorization: Bearer` a cada llamada de la API.

1. `pnpm aws:env` y copiar `COGNITO_USER_POOL_ID` y `COGNITO_CLIENT_ID` a `apps/api/.env`, con `AUTH_MODE=cognito`.
2. Copiar `apps/web/.env.example` a `apps/web/.env.local` y poner los mismos dos IDs en `VITE_COGNITO_USER_POOL_ID` y `VITE_COGNITO_CLIENT_ID`.
3. `pnpm aws:users` (una vez) y `pnpm dev`; entrar con un usuario de prueba y `TOQUI_DEV_PASSWORD`.

Sin `apps/web/.env.local` la web usa un ingreso local de prueba (cualquier contraseña, sin token) y la API debe estar en `AUTH_MODE=local`. Mezclar ambos modos falla: con `AUTH_MODE=local` la API rechaza los tokens reales con 401, y con `AUTH_MODE=cognito` rechaza las peticiones sin token.

Cerrar sesión revoca el refresh token del dispositivo, borra los tokens y los datos del jardín en memoria y vuelve al ingreso. Si la API rechaza el token (401), la web cierra la sesión y pide ingresar de nuevo; un 403 (cuenta sin grupo o jardín) también cierra la sesión y lo explica. Un corte de red no cierra la sesión: la app espera y reintenta. Pendientes: pantalla de nueva contraseña (usuarios con contraseña temporal), recuperación de contraseña e ingreso con código por correo (requiere `FeaturePlan.ESSENTIALS`, con costo).

## Usuarios de prueba (sintéticos)

| Email | Grupo | Jardín |
| --- | --- | --- |
| `educadora.jar0001@example.com` | `educadora` | `JAR-0001` |
| `directora.jar0001@example.com` | `directora` | `JAR-0001` |

Se crean o actualizan con `pnpm aws:users` usando `TOQUI_DEV_PASSWORD` de `infra/.env`.

Usuario personal (opcional, en lugar de compartir la contraseña): crearlo con `aws cognito-idp admin-create-user` (`email`, `email_verified=true`, `custom:id_jardin`), `admin-set-user-password --permanent` y `admin-add-user-to-group`, y poner `TOQUI_PERSONAL_EMAIL` y `TOQUI_PERSONAL_PASSWORD` en `infra/.env`; `pnpm aws:smoke` ingresa con él y comprueba que el token traiga un grupo válido y un jardín (los mismos requisitos de la API, que si no responde 403).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm aws:smoke` | Prueba de humo de los 5 servicios |
| `pnpm aws:env` | Imprime las variables para `apps/api/.env` |
| `pnpm aws:users` | Crea o actualiza los usuarios de prueba |
| `pnpm aws:diff` | Muestra qué cambiaría un despliegue |
| `pnpm aws:deploy` | Despliega `ToquiDev` (avisar al equipo antes: el stack es compartido) |
| `pnpm aws:destroy` | Borra `ToquiDev` con todo su contenido |
| `pnpm aws:bootstrap` | Inicializa CDK en la cuenta; ya hecho el 15-10-2026, no repetir |

Los comandos usan el perfil `toqui` salvo que `AWS_PROFILE` indique otro.

## Reglas del equipo

- No modificar por consola lo que crea CDK (bucket, Cognito, Guardrail): el próximo despliegue lo revierte o falla.
- Solo datos sintéticos: ningún audio, foto ni texto de niños o niñas reales.
- Las credenciales quedan en el perfil local de AWS; nunca en `.env` versionados ni en el chat.
- Avisar antes de `pnpm aws:deploy` o `pnpm aws:destroy`.

## Costos y limpieza

Costo fijo cercano a cero: S3, Cognito (pocos usuarios) y Guardrail cobran por uso. Lo variable es Bedrock (tokens) y Transcribe (por minuto de audio); una ejecución de `pnpm aws:smoke` cuesta centavos. Conviene una alerta en Billing → Budgets. Al terminar la hackatón: `pnpm aws:destroy`.
