## Purpose

Que los datos originales de una nota (texto sin anonimizar y referencia al audio o la foto) no se conserven más que el plazo de S3, y que una captura se pueda borrar completa sin perder la observación confirmada de la trayectoria.

## ADDED Requirements

### Requirement: Retención de 7 días del original
La API SHALL vaciar el texto original y la referencia al archivo de las capturas creadas hace más de 7 días, de forma automática y sin intervención del equipo. SHALL conservar el texto anonimizado del borrador, la observación confirmada y los metadatos de la captura.

#### Scenario: Captura con más de 7 días
- **WHEN** se ejecuta la retención y existe una captura de texto creada hace 8 días
- **THEN** su `texto` queda vacío, su borrador conserva `textoFuente` y el detalle informa `texto: null`

#### Scenario: Captura reciente
- **WHEN** se ejecuta la retención y existe una captura creada hace 2 días
- **THEN** su texto y su archivo siguen disponibles

#### Scenario: Archivo expirado
- **WHEN** se pide el detalle de una captura de audio con más de 7 días
- **THEN** informa `tieneArchivo: false` y pedir su archivo responde 404

### Requirement: Borrado completo de una captura
Borrar una captura SHALL borrar su borrador, su corrección y sus eventos de tiempo. La observación confirmada SHALL conservarse sin vínculo con la captura.

#### Scenario: Borrar una captura confirmada
- **WHEN** se borra una captura confirmada
- **THEN** desaparecen su borrador, su corrección y sus eventos, y su observación sigue en la trayectoria del niño o niña con `id_captura` nulo
