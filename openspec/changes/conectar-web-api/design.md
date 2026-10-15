# Design

## Context

La API expone lecturas síncronas del jardín (`/ninos`, `/manifestaciones`, `/ninos/:id/trayectoria`). La web tenía sus propios tipos (`Nino` con nombre e iniciales, `Nota` con un área) y datos inventados en `datos.ts`.

## Decisions

### 1. Consultas en `api.ts` con el cliente generado
Los hooks usan las funciones de orval con React Query. El cliente generado no lanza ante un error HTTP, así que `api.ts` lo convierte en excepción para que la pantalla de error funcione. El único mapeo es de presentación: nombre corto («Antonella F.», porque hay nombres repetidos en el jardín), iniciales y color del avatar. No hay una capa de adaptadores del modelo.

### 2. Una sola carga al entrar
`RegistroApp` espera niños, niñas, catálogo y niveles antes de mostrar la app, y los pasa por props. Las pantallas siguen siendo componentes sin consultas, salvo la ficha y «Mi sala», que piden los registros de cada niño o niña.

### 3. Historial de 3 años en la ficha
El dataset tiene pocas observaciones recientes por niño o niña: en el jardín de prueba, la mayoría no tiene ninguna en los últimos 180 días. La ficha pide 3 años para mostrar sus últimos registros, y el conteo por área sigue usando 30 días.

### 4. Propuesta simulada con la forma del borrador
`propuesta.ts` reproduce al proveedor `fake` de la API: el nivel esperado para la edad y una manifestación de ese nivel en el dominio que sugieren las palabras clave, con la primera oración como cita. Usa el catálogo y los niveles reales, así que la revisión ya es la definitiva; solo cambiará de dónde viene la propuesta.

### 5. Todas las manifestaciones del nivel confirmado
Cambiar el nivel quita las manifestaciones de otro nivel, porque la confirmación de la API (`POST /capturas/:id/confirmacion`) las rechaza con 422.

## Risks

- Las notas nuevas se pierden al recargar hasta que exista el guardado en la API.
- «Mi sala» hace una consulta de trayectoria por niño o niña de la sala (13 en el dataset). Es aceptable para la demo; un resumen por sala en la API lo evitaría.
