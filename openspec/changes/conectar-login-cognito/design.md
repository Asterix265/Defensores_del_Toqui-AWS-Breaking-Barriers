# Design

## Context

Cognito (`crearIdentidad` en `infra/lib/componentes.ts`): login por correo, grupos `educadora` y `directora`, atributo `custom:id_jardin`, cliente web sin secreto con SRP (y `USER_PASSWORD_AUTH` solo en dev, para la prueba de humo). La API (`AuthGuard`) exige el **ID token** porque el de acceso no trae el correo ni el jardín; responde 401 sin token válido y 403 sin grupo o jardín. El cliente web lo genera orval con `fetch` y no tenía un punto común para las cabeceras.

## Decisions

### 1. Correo y contraseña con SRP, no código por correo
Es lo que el pool y los usuarios de prueba ya soportan, en dev y en prod, sin desplegar ni cambiar el plan de Cognito. SRP comprueba la contraseña sin enviarla. El código por correo queda pendiente (requiere `FeaturePlan.ESSENTIALS`).

### 2. Amplify Auth v6 (solo `aws-amplify/auth`)
Implementa SRP, guarda los tokens y los renueva con el refresh token. Escribir SRP a mano no aporta. Se importa solo el módulo de autenticación. Los tokens quedan en `localStorage` (valor por defecto de Amplify), lo que permite que la PWA recuerde la sesión; el riesgo frente a XSS se acepta para la demo porque la app no renderiza HTML de terceros.

### 3. Configuración en el build
`VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID` y `VITE_AWS_REGION`. No son secretos. En Amplify Hosting los pone `pnpm aws:prod:amplify`; en local, `apps/web/.env.local` (ignorado por Git). Sin ellas, la web usa el modo local.

### 4. Un proveedor de sesión con dos implementaciones
`src/auth/sesion.ts` expone `iniciarSesion`, `cerrarSesion`, `haySesion` e `idToken`. Con Cognito delega en Amplify; en modo local guarda una marca en `sessionStorage`, no envía token y la API local responde con su educadora fija. Las pruebas usan el modo local o simulan el módulo.

### 5. Token en el `mutator` de orval
`src/api/fetch-con-token.ts` reemplaza a `fetch` en el cliente generado y conserva la forma `{ data, status, headers }`. Pide el token a `fetchAuthSession()` en cada llamada (Amplify lo cachea y lo renueva si vence). Las subidas a S3 con URL firmada no pasan por el `mutator`: no deben llevar el token.

### 6. 401 → sesión terminada
Si la API responde 401 a una petición que llevaba token, el `mutator` emite un evento; la app cierra la sesión local y muestra el ingreso con «Tu sesión terminó. Ingresa de nuevo.». Un 403 de `/me` (persona sin grupo o jardín) cierra la sesión y lo explica.

### 7. Cierre de sesión
Botón en el inicio del celular y en el menú de la educadora del panel de escritorio. Pide confirmación (evita salir por un toque accidental en un celular compartido). Al confirmar: `signOut()` revoca el refresh token del dispositivo en Cognito (si la red falla, igual borra los tokens locales), se vacía la caché de React Query (niños, niñas y notas del jardín) y se olvida la sala recordada. No se usa `global: true`, que cerraría la sesión en todos los dispositivos de la educadora.

### 8. Pantalla de ingreso
Celular: pantalla completa, como el resto de la app. Escritorio (`md` o más): dos columnas, la marca a la izquierda y el formulario en una tarjeta a la derecha. Campos con `autocomplete="username"` y `current-password` para los gestores de contraseñas, botón para mostrar la contraseña y mensajes en español; «Correo o contraseña incorrectos» no distingue si el usuario existe (`preventUserExistenceErrors`).

## Risks

- Los tokens en `localStorage` son legibles por cualquier script de la página; mitigación: sin HTML de terceros, CSP pendiente.
- Una persona con contraseña temporal no puede entrar hasta que se implemente la pantalla de nueva contraseña; la web lo avisa.
- Probar con Cognito en local exige la API con `AUTH_MODE=cognito`; con `AUTH_MODE=local` la API rechaza los tokens reales con 401.
