# Proposal

## Why

La web ya guarda notas en la API (`persistir-capturas`), pero el ingreso es simulado: acepta cualquier correo y código y nunca envía un token. Funciona solo porque la API local corre con `AUTH_MODE=local`; en producción la API exige el ID token de Cognito y la web no lo manda. Sin identidad real tampoco se sabe qué educadora registró cada nota ni de qué jardín es, y eso es la base de la trazabilidad del desafío E-1. El User Pool (`ToquiDev`, `ToquiApp`) y la validación en la API (`definir-mvp-e1`, tarea 3.2) ya existen; falta la web.

## What Changes

- **Ingreso con correo y contraseña contra Cognito** (flujo SRP, con Amplify Auth v6). Reemplaza el ingreso simulado con código. Una sola pantalla, adaptada a celular y a navegador de escritorio.
- **Token en cada llamada a la API**: un `mutator` de orval agrega `Authorization: Bearer <ID token>`; Amplify renueva el token antes de que expire.
- **Identidad desde `GET /me`**: nombre o correo, grupo y jardín reales en el inicio y en la cabecera del panel.
- **Cierre de sesión** en celular y escritorio, con confirmación: revoca el refresh token del dispositivo, borra los datos del jardín guardados en memoria y vuelve al ingreso.
- **Sesión vencida o inválida**: si la API responde 401, la web cierra la sesión local y pide ingresar de nuevo con un aviso.
- **Modo local sin Cognito**: si no hay `VITE_COGNITO_*`, la web conserva un ingreso de prueba sin token (la API en `AUTH_MODE=local` responde con la educadora fija), rotulado como tal.

**Hechos**: el cliente web de Cognito no tiene secreto y admite SRP en dev y prod. `pnpm aws:prod:amplify` ya entrega `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID` y `VITE_AWS_REGION` al build de Amplify Hosting.

**Supuestos**: los usuarios de prueba (`pnpm aws:users`) tienen contraseña permanente; no se crean usuarios con contraseña temporal.

**Exclusiones (pendientes)**: pantalla de nueva contraseña para el desafío `NEW_PASSWORD_REQUIRED` y recuperación de contraseña; ingreso sin contraseña con código por correo (requiere `FeaturePlan.ESSENTIALS`, con costo, y desplegar el pool compartido). No cambia infraestructura.

**Beneficio y medición**: no reduce horas de documentación por sí mismo; habilita atribuir cada nota a quien la registró. Se verifica con que `GET /me` devuelva el jardín del token y con que las capturas creadas desde la web queden con el `sub` de la educadora.

## Capabilities

### New Capabilities

- `sesion-web`: ingreso, identidad, uso del token, expiración y cierre de sesión en la web.

## Impact

- Web: dependencia `aws-amplify`, módulo `src/auth`, `mutator` de orval (cliente regenerado con `pnpm contract`), `Ingreso`, `RegistroApp`, `Inicio`, `CabeceraPanel`; pruebas.
- Configuración: `apps/web/.env.example` con `VITE_COGNITO_*`; para probar con Cognito en local, la API con `AUTH_MODE=cognito` y los IDs de `pnpm aws:env`.
- Cierra la tarea 3.3 de `conectar-web-api` en lo que respecta a la identidad; la sala de la educadora sigue sin venir de `/me` (el token no la trae).
