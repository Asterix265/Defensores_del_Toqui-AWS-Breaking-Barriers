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

## 5. Correcciones de la revisión

- [x] 5.1 Cerrar sesión cambia de pantalla antes de revocar, cancela las consultas en vuelo y no vuelve a cerrarse hasta el próximo ingreso; el ingreso espera la revocación anterior
- [x] 5.2 Solo un 401 a una petición con token termina la sesión; una falla de red al renovar el token no se confunde con «sin sesión» (al abrir ni durante el uso)
- [x] 5.3 Pasos de ingreso `CONFIRM_SIGN_UP` y MFA con mensaje propio; el intento a medias se descarta
- [x] 5.4 Cualquier 403 de la API se trata como cuenta sin jardín; mensaje sin API sin referencias a `pnpm dev`
- [x] 5.5 `pnpm aws:smoke` valida grupo y jardín del token sin valores fijos para el usuario personal
- [x] 5.6 Limpieza: `CLAVE_SESION_LOCAL` exportada, solo `Marco`, `Punto` con color

## Pendientes (fuera de este cambio)

- Pantalla de nueva contraseña para `NEW_PASSWORD_REQUIRED` y recuperación de contraseña.
- Ingreso con código por correo (`EMAIL_OTP`), que requiere `FeaturePlan.ESSENTIALS` y desplegar el pool compartido.

## Workflow follow-up

- Validar con `openspec validate conectar-login-cognito --strict --no-interactive`.
