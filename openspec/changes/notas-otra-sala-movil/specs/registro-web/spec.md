# Spec Delta

## ADDED Requirements

### Requirement: Registrar en cualquier sala desde el celular
La ficha del niño o niña en el celular SHALL ofrecer grabar audio, tomar una foto y escribir una nota asociada a ese niño o niña, de cualquier sala del jardín. «¿De quién es?» en el celular SHALL ofrecer los niños y niñas de todas las salas del jardín, agrupados por sala, con la sala que se está viendo en «Mi sala» primero.

#### Scenario: Texto desde la ficha de otra sala
- **WHEN** la educadora elige otra sala en «Mi sala», abre la ficha de un niño o niña de esa sala y presiona «Escribir»
- **THEN** escribe la nota, la revisa y la guarda para ese niño o niña sin volver a elegirlo

#### Scenario: Grabar desde la barra después de cambiar de sala
- **WHEN** la educadora ve otra sala en «Mi sala» y presiona Grabar en la barra inferior
- **THEN** «¿De quién es?» muestra primero esa sala y después las demás salas del jardín
