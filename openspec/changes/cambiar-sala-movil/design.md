# Design

## Context

`MiSala` lista `NINOS_DE_MI_SALA` y muestra la sala fija (`SALA`) como subtítulo. `RegistroApp` maneja la navegación con su estado `vista` (`sala`, `ficha`, `nueva` con `ninoId` opcional). `NuevaNota` busca al niño o niña en `NINOS_DE_MI_SALA` (o en `NINOS` en escritorio), por lo que un `ninoId` de otra sala no se encuentra y la revisión no se muestra. Motivación: `proposal.md`. Requisitos: `specs/ficha-nino/spec.md`.

## Goals / Non-Goals

**Goals:**
- Cambiar de sala sin agregar filas ni controles nuevos a la pantalla: el selector reemplaza al subtítulo que ya existía.
- Que la sala propia siga siendo la vista por defecto.

**Non-Goals:**
- Router o sala en la URL.
- Persistir la sala elegida.
- Que la sala elegida afecte a Inicio, Mis notas o Grabar de la barra.

## Decisions

### 1. Selector en el subtítulo, con menú
El nombre de la sala se vuelve un botón con un chevron (alto mínimo de 44 px) que abre un `Menu` de MUI con las tres salas, la cantidad de niños y niñas de cada una y «Tu sala» en la propia. Un menú ocupa espacio solo mientras está abierto.
*Alternativas descartadas:* fila de chips o pestañas con las tres salas (los nombres no caben a 360 px sin desplazamiento horizontal, y suman una fila permanente); hoja inferior (más pesada para elegir entre tres opciones).

### 2. Sala elegida en `RegistroApp`, fuera de la vista
`RegistroApp` guarda `salaVista` (por defecto `SALA`) y se lo pasa a `MiSala`. Así sobrevive a ir y volver de la ficha. No se mete en `Vista` ni la leen las vistas de registro, para no reintroducir un «contexto actual» que Grabar de la barra pudiera heredar.

### 3. `NuevaNota` busca al niño o niña preseleccionado en todas las salas
El niño o niña se busca en `NINOS`. La grilla para elegir sigue usando la sala propia en el celular. Así, Grabar desde una ficha de otra sala funciona y el modo general no cambia.

### 4. Función `ninosDeSala`
`datos.ts` expone `ninosDeSala(sala)`. `NINOS_DE_MI_SALA` pasa a ser `ninosDeSala(SALA)`.

## Risks / Trade-offs

- [Que la tía no note que está viendo otra sala] → el selector siempre muestra el nombre de la sala elegida y el menú marca «Tu sala».
- [Que el selector pase desapercibido] → el chevron y el rótulo accesible «Cambiar sala» lo identifican. Con tres salas no hace falta más.
- [Al recargar se vuelve a la sala propia] → es deliberado: es la sala que más se usa.

## Open Questions

- Si Mis notas y Grabar de la barra deben seguir a la sala elegida (ver propuesta).
