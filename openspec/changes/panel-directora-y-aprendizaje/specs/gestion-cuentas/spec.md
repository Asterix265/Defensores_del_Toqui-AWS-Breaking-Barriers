# Spec Delta

## ADDED Requirements

### Requirement: La directora invita cuentas de su jardín
Una persona del grupo `directora` SHALL poder crear una cuenta con correo, nombre y grupo (`educadora` o `directora`). La cuenta SHALL quedar con el `custom:id_jardin` del token de la directora, nunca del cuerpo de la petición. Cognito SHALL enviar por correo una contraseña temporal. El grupo `educadora` SHALL recibir 403. No SHALL existir autorregistro.

#### Scenario: Invitar a una educadora
- **WHEN** la directora de JAR-0001 invita a `nueva.tia@example.com` como educadora
- **THEN** la cuenta queda en el grupo `educadora` con `custom:id_jardin=JAR-0001` y aparece «Invitación enviada» en «Equipo»

#### Scenario: Jardín en el cuerpo
- **WHEN** la petición de invitación incluye un `idJardin` distinto
- **THEN** la API lo ignora o rechaza la petición, y la cuenta queda en el jardín de la directora

#### Scenario: Correo ya registrado
- **WHEN** la directora invita un correo que ya existe
- **THEN** la API responde 409 y la web muestra «Ese correo ya tiene cuenta»

#### Scenario: Invitación que quedó sin rol
- **WHEN** Cognito creó la cuenta pero falló la asignación del grupo
- **THEN** la API responde 503 y pide volver a invitar el mismo correo

#### Scenario: Volver a invitar una cuenta sin rol
- **WHEN** la directora invita de nuevo un correo de su jardín cuya cuenta no tiene grupo y no ha cambiado la contraseña temporal
- **THEN** la API le asigna el grupo pedido, reenvía la contraseña temporal y la cuenta aparece como invitación pendiente; si la cuenta es de otro jardín, ya tiene grupo o ya cambió la contraseña, responde 409

### Requirement: Listar y desactivar cuentas del jardín
La directora SHALL ver las cuentas de su jardín con correo, nombre, grupo, estado (activa, desactivada o invitación pendiente) y fecha de creación, y SHALL poder desactivar, reactivar o reenviar la invitación. SHALL NOT poder actuar sobre cuentas de otro jardín ni desactivarse a sí misma.

#### Scenario: Desactivar a una educadora
- **WHEN** la directora desactiva una cuenta de su jardín
- **THEN** la cuenta queda desactivada y ya no puede ingresar

#### Scenario: Cuenta de otro jardín
- **WHEN** la directora de JAR-0001 intenta desactivar una cuenta de JAR-0002
- **THEN** la API responde 403

### Requirement: Nueva contraseña en el primer ingreso
Cuando Cognito pide una contraseña nueva, la web SHALL mostrar «Crea tu contraseña» con las reglas de la política del pool y, al confirmarla, SHALL completar el ingreso sin volver a pedir el correo.

#### Scenario: Primer ingreso con contraseña temporal
- **WHEN** una persona invitada ingresa con la contraseña temporal del correo
- **THEN** la web le pide la contraseña nueva dos veces y, al guardarla, entra a la app

#### Scenario: Contraseña que no cumple la política
- **WHEN** la contraseña nueva es más corta que el mínimo
- **THEN** la web explica la regla y no envía la petición
