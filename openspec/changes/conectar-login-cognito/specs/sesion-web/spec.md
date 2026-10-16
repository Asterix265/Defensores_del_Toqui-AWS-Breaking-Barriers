# Spec Delta

## ADDED Requirements

### Requirement: Ingreso con correo y contraseña
La web SHALL pedir correo y contraseña antes de mostrar datos del jardín y SHALL validarlos contra el User Pool de Cognito. Ante credenciales incorrectas SHALL mostrar un mensaje que no revele si el correo existe. La pantalla SHALL adaptarse a celular y a navegador de escritorio.

#### Scenario: Ingreso correcto
- **WHEN** la educadora sintética `educadora.jar0001@example.com` escribe su contraseña y presiona «Entrar»
- **THEN** la web ve el inicio con su nombre y los niños y niñas de `JAR-0001`

#### Scenario: Contraseña incorrecta
- **WHEN** la contraseña no corresponde
- **THEN** la web muestra «Correo o contraseña incorrectos» y sigue en el ingreso

#### Scenario: Escritorio
- **WHEN** la ventana es ancha
- **THEN** el ingreso muestra la marca y el formulario en dos columnas

### Requirement: Token en las llamadas a la API
Cada llamada de la web a la API SHALL llevar `Authorization: Bearer` con el ID token vigente. Las subidas a S3 con URL firmada SHALL NOT llevarlo.

#### Scenario: Petición autenticada
- **WHEN** la web pide los niños y niñas con una sesión activa
- **THEN** la petición lleva el ID token de la sesión

### Requirement: Identidad desde la API
Tras ingresar, la web SHALL obtener nombre, grupo y jardín de `GET /me`. Si la API responde 403 por falta de grupo o jardín, SHALL cerrar la sesión y explicarlo.

#### Scenario: Persona sin jardín
- **WHEN** `/me` responde 403
- **THEN** la web vuelve al ingreso con el aviso de que la cuenta no tiene un jardín asignado

### Requirement: Sesión terminada
Si la API responde 401 a una petición con token, la web SHALL cerrar la sesión local y volver al ingreso con un aviso.

#### Scenario: Token rechazado
- **WHEN** la API responde 401 mientras la educadora usa la app
- **THEN** la web muestra el ingreso con «Tu sesión terminó. Ingresa de nuevo.»

### Requirement: Cierre de sesión
La web SHALL ofrecer cerrar sesión en el celular y en el panel de escritorio, con confirmación. Al confirmar SHALL revocar la sesión del dispositivo, borrar de la memoria los datos del jardín y volver al ingreso. Recargar la página después SHALL NOT recuperar la sesión.

#### Scenario: Cerrar sesión en el celular
- **WHEN** la educadora presiona «Cerrar sesión» y confirma
- **THEN** ve el ingreso, y al recargar sigue en el ingreso

#### Scenario: Cancelar
- **WHEN** la educadora presiona «Cerrar sesión» y luego «Cancelar»
- **THEN** sigue en la pantalla donde estaba, con su sesión
