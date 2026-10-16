# Proposal

## Why

La revisión de la web desplegada (16-10-2026) dejó cinco fallas y un vacío operativo que impiden mostrar el valor del desafío E-1: pasar de la observación a la acción sin sumar documentación.

- En PC, después de guardar una nota, la página deja de desplazarse.
- La tía no ve el estado de su sala por núcleo ni quiénes necesitan atención: tiene que abrir ficha por ficha.
- No existe la vista general de la directora (pedida explícitamente): todas las salas del jardín a la vez, con cobertura, alertas y edades.
- Los datos no se pueden sacar de la app (no hay exportación a CSV), así que el reporte se vuelve a armar a mano.
- La IA no aprende de lo que corrige la tía: cada corrección queda en la tabla `correcciones`, pero ninguna vuelve a la clasificación. La tía corrige los mismos errores una y otra vez.
- No hay forma de crear cuentas: el User Pool tiene `selfSignUpEnabled: false` y solo `pnpm aws:prod:users` crea los dos usuarios de prueba.

## What Changes

- **Scroll**: la página vuelve a desplazarse al cerrar o terminar cualquier diálogo de la nota.
- **Estado de la sala** (tía y directora): por núcleo, la distribución del último nivel validado, la mediana, la cobertura (con y sin decisión válida) y los niños o niñas con alerta, resaltados en la lista de la sala. Las reglas son las de demostración de `metodologia.md` del dataset.
- **Vista general de la directora**: una pestaña «Jardín» solo para el grupo `directora`, con una tarjeta por sala (nivel educativo, matrícula, rango y promedio de edad en meses, cobertura, alertas individuales, alertas de sala y notas de los últimos 30 días) y acceso al estado detallado de cada sala.
- **Exportar CSV**: botón «Descargar CSV» en el estado de la sala, en la vista general y en la tabla de notas. El archivo se genera en la web con los datos que ya muestra la pantalla.
- **Aprender de las correcciones**: al despachar una captura, la API agrega al mensaje de la cola hasta 5 decisiones previas de educadoras del mismo jardín y nivel educativo (texto anonimizado del borrador, nivel y manifestaciones confirmadas), priorizando las que corrigieron a la IA. La Lambda las pasa como `ejemplos` al prompt, que ya tiene la sección «Casos parecidos».
- **Cuentas**: la directora invita personas de su jardín (correo, nombre y rol: educadora o directora) y puede desactivarlas desde la pestaña «Equipo». La API usa `AdminCreateUser` con `custom:id_jardin` de la directora, y Cognito envía la contraseña temporal por correo. En el primer ingreso la web pide definir la contraseña nueva (hoy responde «nueva_clave» y no deja seguir).

**Hechos**: las valoraciones guardan `nivelValidado`, `estado` y `fechaCorte` por niño o niña, núcleo y sala (dataset y app). `metodologia.md` define las alertas: última decisión validada con antigüedad máxima de 45 días; alerta individual con 2 o más posiciones bajo la mediana de al menos 5 pares de la misma sala; alerta de sala con una brecha de 1,5 o más frente a la mediana de las otras salas equivalentes del jardín (al menos 2 salas con información). El puerto `FuenteContexto` y la sección «Casos parecidos» del prompt ya existen; hoy se usa `ContextoVacio`. El mensaje de la cola es autosuficiente: la Lambda no consulta la base. `Borrador.textoFuente` ya está anonimizado por el Guardrail. El grupo `directora` ya existe en Cognito y en la API.

**Supuestos**: el «estado ponderado» que pidió el equipo se cubre con la distribución, la mediana y las alertas por núcleo, sin un promedio de niveles, porque la metodología lo desaconseja. Basta con aprender en contexto (ejemplos en el prompt), sin reentrenar ni ajustar el modelo. El correo de invitación por defecto de Cognito (hasta 50 al día sin SES) alcanza para la demo.

**Exclusiones**: autorregistro, recuperación de contraseña y MFA; ajuste fino del modelo y memoria vectorial (S3 Vectors); exportar a Excel o PDF; comparaciones entre jardines; derivaciones automáticas.

## Capabilities

### New Capabilities

- `estado-salas`: estado por núcleo de cada sala, alertas relativas, vista general de la directora y exportación a CSV.
- `aprendizaje-correcciones`: las decisiones previas de las educadoras vuelven a la clasificación como ejemplos.
- `gestion-cuentas`: invitación y desactivación de cuentas por la directora, y nueva contraseña en el primer ingreso.

### Modified Capabilities

(ninguna: `registro-web` sigue en el cambio `corregir-interfaz-web`, sin sincronizar; el arreglo del scroll se especifica en `estado-salas` para no depender de él)

## Impact

- API (`apps/api`): módulo `salas` (`GET /salas/estado`, `GET /jardin/resumen`), módulo `cuentas` (`GET/POST /cuentas`, `POST /cuentas/:usuario/desactivacion`), ejemplos en `DespachadorService` (`EjemplosService`). Sin migraciones de base de datos.
- Contrato (`packages/shared`): esquemas de estado de sala, resumen del jardín, cuentas y `ejemplos` opcionales en `MensajeCaptura`; regenerar OpenAPI y orval.
- Pipeline (`apps/pipeline`): `ContextoDesdeMensaje` en lugar de `ContextoVacio`.
- Web (`apps/web`): arreglo del scroll, estado de la sala, pestañas «Jardín» y «Equipo» para la directora, CSV y pantalla de nueva contraseña.
- Infraestructura (`infra/lib/app-stack.ts`): permisos `cognito-idp:AdminCreateUser`, `AdminAddUserToGroup`, `AdminListGroupsForUser`, `AdminDisableUser`, `AdminEnableUser`, `AdminGetUser` y `ListUsersInGroup` sobre el pool de producción, solo para el rol de tarea de la API. `ToquiDev` le da los mismos permisos al perfil local. Sin recursos nuevos.
- **Medición del beneficio**: la directora ve las 6 salas de su jardín en una pantalla (hoy no tiene vista); la tía identifica a los niños y niñas con alerta sin abrir fichas (hoy, una por una); el reporte sale en un clic; en un conjunto de 5 notas sintéticas parecidas a una corrección previa, la propuesta coincide con la decisión de la tía más veces con ejemplos que sin ellos (se informa la cifra, sin prometer un porcentaje).
