## ADDED Requirements

### Requirement: Autenticación y rol desde el token
La API SHALL exigir un token válido de Cognito en todas las rutas excepto `/health`, y SHALL tomar la identidad y el rol (`registrador` o `supervisor`) del token, nunca del cuerpo de la petición. El rol SHALL revisarse en el servidor.

#### Scenario: Sin token
- **WHEN** se llama a `GET /me` sin token o con un token inválido
- **THEN** la API responde 401

#### Scenario: Registrador en el panel
- **WHEN** un registrador llama a `GET /panel/observaciones`, `GET /panel/resumen` o `POST /observaciones/:id/validacion`
- **THEN** la API responde 403

#### Scenario: Quién soy
- **WHEN** una persona autenticada llama a `GET /me`
- **THEN** recibe su identificador, rol, nombre y teléfono, y queda registrada en `usuarios`

### Requirement: Criterios fijos
`GET /criterios` SHALL devolver los criterios activos en su orden.

#### Scenario: Criterio inactivo
- **WHEN** existe un criterio con `activo = false`
- **THEN** no aparece en la lista y no se acepta en revisiones ni validaciones (422)

### Requirement: Subida de archivos
`POST /subidas` SHALL devolver un POST firmado de S3 que dure 5 minutos, limitado al tipo declarado (audio o imagen admitidos), a un máximo de 10 MB y a la carpeta `subidas/<sub>/` de la persona.

#### Scenario: Tipo no admitido
- **WHEN** un registrador pide subir `video/mp4` o más de 10 MB
- **THEN** la API responde 400

### Requirement: Creación de observaciones
`POST /observaciones` SHALL crear la observación como `pendiente` con la fecha del día en Chile, SHALL encolarla en SQS y SHALL devolver su id. Para audio o foto SHALL verificar que el archivo está en la carpeta propia, ya subido y del tipo declarado.

#### Scenario: Texto
- **WHEN** un registrador envía `{tipo: 'texto', texto}`
- **THEN** recibe 201 con el id y estado `pendiente`, y la observación se encola

#### Scenario: Archivo ajeno o no subido
- **WHEN** la clave está fuera de `subidas/<sub>/`, no existe en S3, su tipo no corresponde o ya pertenece a otra observación
- **THEN** la API responde 422 y no encola nada

#### Scenario: Cola caída
- **WHEN** SQS falla al encolar
- **THEN** la observación queda en `error` y la API responde 503

### Requirement: Consulta de la propuesta
`GET /observaciones/:id` SHALL devolver el estado y, cuando exista, la propuesta: criterio, confianza, las dos opciones si hay duda y una URL temporal del audio de Polly.

#### Scenario: Observación ajena
- **WHEN** un registrador pide una observación de otra persona o un id inválido
- **THEN** la API responde 404, sin revelar si existe

#### Scenario: Id inválido en cualquier ruta
- **WHEN** el id no es un UUID en consulta, revisión, validación o archivo
- **THEN** la API responde 404

#### Scenario: Supervisor
- **WHEN** un supervisor pide cualquier observación
- **THEN** la recibe

### Requirement: Revisión del registrador
`POST /observaciones/:id/revision` SHALL marcar la observación como `confirmada` si el criterio coincide con la propuesta, o `corregida` si no. SHALL guardar la decisión en `revisiones` y como ejemplo del registrador.

#### Scenario: Sin propuesta
- **WHEN** la observación está `pendiente` o `procesando`
- **THEN** la API responde 409

#### Scenario: Ya validada
- **WHEN** el supervisor ya validó la observación
- **THEN** la API responde 409 y la observación no cambia

#### Scenario: Observación en error
- **WHEN** el procesamiento falló y la observación está en `error`
- **THEN** el registrador puede elegir el criterio a mano y la observación queda `corregida`; la API no ofrece reencolarla

### Requirement: Validación del supervisor
`POST /observaciones/:id/validacion` SHALL dejar la observación `validada` con el criterio elegido, SHALL registrar quién y cuándo validó, y SHALL guardar un ejemplo del supervisor con más peso que el del registrador.

#### Scenario: Validar
- **WHEN** un supervisor valida con un criterio activo
- **THEN** la observación queda `validada` y el ejemplo del supervisor tiene peso 3

### Requirement: Mi día y panel
`GET /mi-dia` SHALL devolver las observaciones propias del día. `GET /panel/observaciones` SHALL filtrar por fecha, persona, criterio y estado, con paginación. `GET /panel/resumen` SHALL contar las observaciones del día por criterio, por estado y por persona.

#### Scenario: Paginación
- **WHEN** el supervisor pide `tamano=1` con dos resultados
- **THEN** recibe un ítem y `total = 2`

### Requirement: Archivo original
`GET /observaciones/:id/archivo` SHALL devolver una URL temporal del original: el registrador solo para las suyas y el supervisor para todas.

#### Scenario: Observación de texto
- **WHEN** la observación no tiene archivo
- **THEN** la API responde 404
