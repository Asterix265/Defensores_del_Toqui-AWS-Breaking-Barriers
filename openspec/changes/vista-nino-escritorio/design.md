# Design

## Context

En pantallas anchas (`md` o más), `RegistroApp` muestra `PanelSalas`, que contiene `CabeceraPanel`, el título con «Descargar reporte» y «Nueva nota», `FiltrosPanel` (chips de sala y periodo) y `TablaNotas`. El celular ya tiene «Mi sala» (`MiSala`) y la ficha (`FichaNino`), y ambos usan `resumenAreas`. Motivación: `proposal.md`. Requisitos: `specs/ficha-nino-escritorio/spec.md`.

## Goals / Non-Goals

**Goals:**
- Que el PC se organice igual que el celular: mismas pestañas, mismo contenido de ficha y misma regla de asociación de notas.
- Reutilizar el cálculo y las piezas visuales del celular en vez de duplicarlas.

**Non-Goals:**
- Router o URLs. La navegación queda en estado local de `PanelSalas`.
- Cambiar «Nueva nota» más allá de aceptar un niño o niña preseleccionado.

## Decisions

### 1. Pestañas en la cabecera
`CabeceraPanel` recibe la sección activa y muestra `Tabs` de MUI con «Mi sala» (`Groups`) y «Mis notas» (`EventNote`), los íconos del celular. Presionar «Mi sala» con una ficha abierta vuelve a la lista, como en el celular.
*Alternativa descartada:* barra lateral. Suma una columna fija para solo dos destinos.

### 2. Estado de navegación en `PanelSalas`
`PanelSalas` guarda `seccion: 'sala' | 'notas'` (por defecto `notas`), `ninoAbierto: string | null`, `sala: string | null` (compartida) y `nueva: { ninoId?: string } | null`. El `ninoId` de «Nueva nota» solo se fija desde el botón de la ficha. La cabecera de cada vista abre `{}`, así que se aplica la misma garantía por forma de datos que en `ficha-nino-movil`.

### 3. Chips de sala reutilizables
`FiltrosPanel` se divide: `ChipsSala` (Todas + una por sala, con una cantidad que define quien lo usa) se usa en ambas pestañas. En «Mis notas» la cantidad es de notas del periodo y en «Mi sala», de niños y niñas. El selector de periodo queda solo en «Mis notas»: «Mi sala» usa los 30 días fijos.

### 4. Ficha de escritorio con piezas compartidas
`FichaNino.tsx` exporta `AreasNino` (las áreas sin notas apiladas y la grilla de las demás) y `UltimasNotas` (artículos con «Ver las N»). La ficha móvil y `panel/FichaEscritorio` las usan. El escritorio las ubica en dos columnas (`minmax(360px, 420px) 1fr`).
*Alternativa descartada:* reutilizar `FichaNino` entera en un contenedor angosto. Desperdicia el ancho y trae el botón de micrófono y el «volver» del celular.

### 5. `NuevaNotaEscritorio` con `ninoId` opcional
Se pasa a `NuevaNota`, que ya sabe saltarse la elección del niño o niña y busca en `NINOS`. Al guardar o cerrar, el diálogo se cierra y la ficha queda abierta.

## Risks / Trade-offs

- [El filtro compartido puede sorprender al cambiar de pestaña] → los chips son visibles en ambas pestañas y muestran la sala activa.
- [«Mis notas» en el PC muestra notas de todas las educadoras] → se mantiene el título «Notas de las salas» bajo la pestaña. Cambiarlo queda fuera de alcance.
- [Las piezas compartidas de la ficha atan los dos layouts] → reciben solo datos y no fijan anchos externos.

## Open Questions

- Si el PC debe tener una pestaña «Inicio» (ver propuesta).
