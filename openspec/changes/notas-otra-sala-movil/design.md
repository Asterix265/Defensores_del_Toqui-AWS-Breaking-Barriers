# Design

## Context

Motivación en `proposal.md`; requisitos en `specs/registro-web/spec.md`. `RegistroApp` pasaba a `NuevaNota` solo `deMiSala` y la ficha solo tenía `onGrabar` (audio).

## Goals / Non-Goals

**Goals:**
- Registrar audio, foto o texto para cualquier niño o niña del jardín desde el celular.

**Non-Goals:**
- Asignar salas por educadora ni restringir el registro por sala.

## Decisions

### D1. La ficha recibe `onNueva(formato)`
Reemplaza a `onGrabar`. «Grabar» sigue siendo el botón principal (rojo); «Foto» y «Escribir» son secundarios, con el mismo tamaño táctil. La nota ya trae el niño o niña (`ninoFijo`), como el audio.

### D2. Todo el jardín en «¿De quién es?», con la sala vista primero
El celular pasa todos los niños y niñas y `salaPrimero = salaVista`. `ElegirNino` agrupa cuando hay más de una sala y pone primero esa sala; el resto sigue el orden de `ordenarSalas`.
*Alternativa descartada:* ofrecer solo la sala que se está viendo. Obligaría a volver a «Mi sala» para registrar en otra sala desde la barra.

## Risks / Trade-offs

- [Lista más larga] El celular muestra más niños y niñas al elegir. → La sala vista va primero, con su título.
