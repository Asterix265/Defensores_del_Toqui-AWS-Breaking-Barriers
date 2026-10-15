# Proposal

## Why

En el celular la educadora tiene «Mi sala» y la ficha de cada niño o niña, con las áreas sin notas recientes como sugerencia de observación. En el navegador (pantallas anchas), en cambio, solo ve la tabla de notas de las salas. Quien revisa o carga notas desde el PC, como la directora o la tía al cierre de la jornada, no puede ver qué hay anotado de un niño o niña ni en qué áreas falta registro sin revisar la tabla fila por fila. Además, el PC y el celular se organizan de forma distinta, y eso obliga a aprender dos apps.

## What Changes

- La cabecera del panel de escritorio suma pestañas **«Mi sala» · «Mis notas»**, con los mismos nombres e íconos de la barra del celular. «Mis notas» es la vista actual (tabla, periodo, reporte CSV y «Nueva nota») y sigue siendo la vista inicial.
- **«Mi sala» en escritorio**: tarjetas de los niños y niñas con «N áreas sin notas» en los últimos 30 días, igual que en el celular. Con «Todas las salas», las tarjetas se agrupan por sala.
- **Ficha en escritorio**: al elegir un niño o niña se abre su ficha dentro del panel, con «volver a Mi sala». Muestra el mismo contenido que en el celular, en dos columnas: a la izquierda las 5 áreas en 30 días, con las áreas sin notas primero como invitación a observar; a la derecha sus últimas notas, 3 visibles y «Ver las N».
- **Nueva nota desde la ficha**: abre el diálogo «Nueva nota» actual (audio, foto o texto) con ese niño o niña ya elegido y, al guardar, vuelve a su ficha. «Nueva nota» de la cabecera de cada vista sigue siendo general y pide elegir al niño o niña.
- **Filtro de sala en ambas pestañas**: los mismos chips (Todas las salas, Sala Cuna Mayor, Sala Cuna Menor y Medio Menor). La sala elegida se comparte entre «Mi sala» y «Mis notas».
- Sigue siendo un mock: datos sintéticos, notas en memoria, sin router ni URLs y sin conexión a la API.

**Hechos**: `PanelSalas` muestra solo la tabla, con chips de sala y periodo. `resumenAreas`, `ninosDeSala` y las tarjetas de área de `FichaNino` ya existen y se prueban en el celular. `NuevaNota` acepta un `ninoId` preseleccionado, pero `NuevaNotaEscritorio` no lo pasa.

**Supuestos**: en el PC se consultan todas las salas del jardín (en el mock no hay permisos). La ventana de 30 días es la misma del celular.

**Decisiones pendientes**: si el escritorio debe tener también «Inicio». Por ahora no: en el celular, Inicio sirve para elegir cómo registrar, y en el PC esa función ya la cumple «Nueva nota».

**Exclusiones**: cambios en los formatos de «Nueva nota», niveles o estimaciones de desarrollo, router o URLs por ficha, recordar la pestaña al recargar y conexión con la API.

## Capabilities

### New Capabilities

- `ficha-nino-escritorio`: consulta en pantallas anchas de los niños y niñas por sala y de su ficha, con pestañas congruentes con las del celular y el filtro de sala compartido.

### Modified Capabilities

(ninguna; `ficha-nino` cubre solo el celular y aún no está archivada)

## Impact

- Código: `apps/web/src/registro/PanelSalas.tsx` y `apps/web/src/registro/panel/` (pestañas, «Mi sala», ficha y chips de sala reutilizables), además de `FichaNino.tsx`, que exporta sus tarjetas de área, y `NuevaNotaEscritorio.tsx`, con `ninoId` opcional.
- Pruebas: Vitest + Testing Library en `apps/web`.
- Documentación: README, en lo que la web muestra en pantallas anchas.
- Sin dependencias nuevas, sin cambios de API, de base de datos ni de AWS.
- **Medición del beneficio**: en el PC, ver las áreas sin notas de un niño o niña toma 2 interacciones desde cualquier pestaña («Mi sala» y el niño o niña); hoy no es posible. Registrar desde su ficha se salta la elección del niño o niña. No se promete reducción de horas de documentación.
