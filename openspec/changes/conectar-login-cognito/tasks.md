# Tasks

## 1. Web

- [x] 1.1 Dependencia `aws-amplify` con versión fija y `apps/web/.env.example` con `VITE_COGNITO_*`
- [x] 1.2 `src/auth`: configuración, sesión con Cognito y modo local, evento de sesión terminada
- [x] 1.3 `mutator` de orval con `Authorization` y `pnpm contract`
- [x] 1.4 Ingreso con correo y contraseña, en celular y escritorio, con mensajes de error en español
- [x] 1.5 `RegistroApp` con sesión real e identidad de `/me`; 401 y 403
- [x] 1.6 Cerrar sesión con confirmación en el inicio del celular y en la cabecera del panel

## 2. Pruebas

- [x] 2.1 Ingreso correcto e incorrecto, sesión recordada, cierre de sesión (confirmar y cancelar), 401 y 403

## 3. Verificación

- [x] 3.1 Lint, formato, typecheck, pruebas y build
- [x] 3.2 Ingreso real contra el pool de `ToquiDev` con la API en `AUTH_MODE=cognito`: `/me` con `JAR-0001`, `/ninos` 200, token falso 401, ingreso en el navegador y `pnpm aws:smoke` 5/5

## 4. Documentación

- [x] 4.1 README y `docs/guia-aws.md`: cómo ingresar en local con y sin Cognito
- [x] 4.2 `pnpm aws:smoke` acepta un usuario personal (`TOQUI_PERSONAL_EMAIL` y `TOQUI_PERSONAL_PASSWORD` en `infra/.env`)

## Pendientes (fuera de este cambio)

- Pantalla de nueva contraseña para `NEW_PASSWORD_REQUIRED` y recuperación de contraseña.
- Ingreso con código por correo (`EMAIL_OTP`), que requiere `FeaturePlan.ESSENTIALS` y desplegar el pool compartido.

## Workflow follow-up

- Validar con `openspec validate conectar-login-cognito --strict --no-interactive`.
