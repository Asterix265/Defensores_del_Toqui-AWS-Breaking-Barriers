# Proposal

## Why

La revisión del frontend (16-10-2026), en el celular y en el escritorio, encontró fallas que hacen perder notas o tiempo a la educadora, que es justo lo que el desafío E-1 quiere evitar:

- En PC, el diálogo «Nueva nota» recorta la revisión: no se llega a «Agregar manifestación» ni a «Está bien», y la nota no se puede confirmar.
- En el celular, el botón Atrás sale de la app (vuelve al sitio anterior del navegador), porque las pantallas no usan el historial.
- Un clic fuera del diálogo, Escape o Cancelar descartan sin aviso una nota en curso (grabación, texto o procesamiento).
- Las notas «Sin revisar» quedan en la API, pero no se pueden abrir desde «Mis notas», y el escritorio ni siquiera las muestra. El mensaje de espera agotada promete que se verán ahí.
- Hay textos incorrectos: «Texto de ejemplo (no es tu audio)» aparece aunque la transcripción sea real, «Notas en las 5 áreas» cuando hay 8 núcleos, y el correo de quien registró se desborda sobre la columna «Nota».
- La revisión muestra detalles técnicos a la tía (ruta en S3, modelo, peso del archivo) y la tabla de PC no permite ver el detalle de una nota.

## What Changes

- Las pantallas del celular y del panel se integran con el historial del navegador: Atrás vuelve a la pantalla anterior de la app (o cierra la nota y el diálogo) y no sale de ella.
- El cuerpo de cada paso de la nota se desplaza y sus acciones principales quedan siempre visibles, en el diálogo de PC y en el celular.
- Salir de una nota en curso pide confirmación. Desde la revisión, cerrar deja la nota «Sin revisar», y se avisa.
- Las notas «Sin revisar» o «Con error» se abren desde «Mis notas» (celular) y desde una sección «Por revisar» (PC), con la misma revisión.
- El aviso de procesamiento muestra un resumen breve y deja los detalles técnicos plegados.
- Las filas de la tabla de notas abren un detalle de solo lectura.
- Correcciones de texto y diseño: etiqueta del texto de la revisión según `procesamiento.simulado`, «Notas en las 8 áreas», correo sin desbordar, scroll al inicio al cambiar de pantalla, salas en orden Sala Cuna → Nivel Medio → Transición, encabezados que pasan a una segunda línea entre 900 y 1100 px y `viewport-fit=cover`.

**Hechos**: la navegación es un `useState` en `RegistroApp` y en `PanelSalas`, sin `pushState`. El papel del diálogo de PC tiene alto fijo y `overflow: hidden`. `GET /capturas/:id` ya devuelve el borrador, así que retomar una nota no requiere cambios en la API.

**Supuestos**: alcanza con el historial, sin rutas en la URL. Al retomar un borrador, el audio o la foto se muestran con la URL temporal de `GET /capturas/:id/archivo`, que ya existe.

**Exclusiones**: el nombre real del jardín en la cabecera (`GET /me` solo trae `idJardin`), un router con URL por pantalla, y cambios de API, de base de datos o de AWS.

## Capabilities

### New Capabilities

- `registro-web`: navegación con el historial, flujo de la nota sin pérdidas y revisión de borradores en la web.

### Modified Capabilities

(ninguna)

## Impact

- Código: `apps/web/src/registro/` (`RegistroApp`, `PanelSalas`, `NuevaNota`, `NuevaNotaEscritorio`, `MisNotas`, `componentes`, `panel/*`, el nuevo `historial.ts`) y `apps/web/index.html`.
- Pruebas: Vitest con Testing Library y MSW en `apps/web`.
- Documentación: README (lo que muestra la web).
- Sin dependencias nuevas.
- **Medición del beneficio**: una nota de audio en PC se puede confirmar sin salir del diálogo (hoy no se puede); un borrador pendiente se retoma en 2 interacciones desde «Mis notas» (hoy hay que registrarlo de nuevo); Atrás no saca de la app en ninguna pantalla. No se promete reducción de horas de documentación.
