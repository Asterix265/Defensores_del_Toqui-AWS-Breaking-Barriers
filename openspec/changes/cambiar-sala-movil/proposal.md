# Proposal

## Why

Hoy «Mi sala» muestra solo la sala fija de la educadora (Sala Cuna Mayor). Si apoya o reemplaza en otra sala del jardín (Sala Cuna Menor o Medio Menor), no puede ver qué hay anotado de esos niños y niñas ni qué áreas no tienen notas, que es lo que necesita para decidir a quién observar. Tendría que pedirle la información a otra educadora o anotar a ciegas, y eso suma trabajo de coordinación y documentación. Agregar la opción no debe complicar la pantalla: la tía la usa con una mano y con la atención puesta en la sala.

## What Changes

- Bajo el título «Mi sala», el nombre de la sala pasa a ser un **selector compacto** («Sala Cuna Mayor ⌄»). Al presionarlo se abre un menú con las tres salas del jardín; la sala propia lleva el rótulo «Tu sala».
- La lista, el conteo de «N áreas sin notas» y las fichas usan la sala elegida.
- La sala elegida se mantiene al entrar a una ficha y volver. Al recargar la app se vuelve a la sala propia.
- Grabar desde la ficha de un niño o niña de otra sala asocia la nota a ese niño o niña, igual que en la sala propia.
- Sin cambios en Inicio, Mis notas, Grabar de la barra inferior (sigue eligiendo entre los niños y niñas de la sala propia) ni en la vista de escritorio.

**Hechos**: `SALAS` ya tiene las tres salas y la vista de escritorio filtra por ellas. `MiSala` usa `NINOS_DE_MI_SALA`. `NuevaNota` busca al niño o niña preseleccionado solo dentro de la sala propia, así que hoy una ficha de otra sala no podría grabar.

**Supuestos**: la educadora puede consultar todas las salas de su jardín (en el mock no hay permisos). El jardín tiene pocas salas (3 en el mock), así que un menú corto basta.

**Decisiones pendientes**: si Grabar de la barra y Mis notas deben seguir a la sala elegida. Por ahora quedan en la sala propia, para que el registro rápido no cambie según lo que se consultó antes, igual que la regla de `ficha-nino-movil`.

**Exclusiones**: permisos por sala, recordar la sala elegida al recargar, conexión con la API y cambios en la vista de escritorio.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `ficha-nino`: la lista de «Mi sala» deja de estar fija en la sala propia y permite elegir otra sala del jardín. Depende de `ficha-nino-movil`, que crea la capacidad y debe archivarse antes.

## Impact

- Código: `apps/web/src/registro/` (`MiSala`, `RegistroApp`, `NuevaNota` y `datos.ts`).
- Pruebas: Vitest + Testing Library en `apps/web`.
- Documentación: README, en lo que la web muestra en el celular.
- Sin dependencias nuevas, sin cambios de API, de base de datos ni de AWS.
- **Medición del beneficio**: llegar a la ficha de un niño o niña de otra sala toma 3 interacciones desde «Mi sala» (selector, sala y niño o niña); hoy no es posible. La vista por defecto no suma interacciones ni elementos fuera del encabezado. No se promete reducción de horas de documentación.
