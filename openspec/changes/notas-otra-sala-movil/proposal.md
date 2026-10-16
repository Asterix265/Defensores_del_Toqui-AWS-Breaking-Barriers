# Proposal

## Why

En la demo (16-10-2026), una educadora quiso probar notas de distintos niveles educativos con la misma cuenta. En el celular puede consultar otra sala desde «Mi sala», pero no puede registrarle foto ni texto a un niño o niña de esa sala:

- la ficha del celular solo tiene el botón de grabar audio;
- Foto, Escribir y Grabar desde Inicio o la barra solo ofrecen a los niños y niñas de la sala propia.

La API ya permite registrar a cualquier niño o niña del jardín del token, y el panel de PC ya ofrece todas las salas.

## What Changes

- La ficha del celular suma «Foto» y «Escribir» junto a «Grabar», con la nota ya asociada al niño o niña, de cualquier sala.
- «¿De quién es?» en el celular ofrece todo el jardín, agrupado por sala, con la sala que se está viendo en «Mi sala» primero.

**Hechos**: `POST /capturas` valida el jardín, no la sala. `NuevaNota` recibía en el celular solo los niños y niñas de la sala propia.

**Exclusiones**: asignar salas a cada educadora, que hoy no existe (la sala propia es la elegida en el celular).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `registro-web`: registrar en cualquier sala desde el celular.

## Impact

- Código: `apps/web/src/registro/` (`FichaNino`, `NuevaNota`, `RegistroApp`) y sus pruebas.
- Sin cambios de API, base de datos ni AWS.
- **Medición del beneficio**: una nota de texto o foto para un niño o niña de otra sala se registra desde su ficha sin cambiar la sala propia; hoy no se puede.
