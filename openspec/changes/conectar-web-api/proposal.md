# Proposal

## Why

La web de «Registro Simple» funcionaba solo con datos inventados (salas, niños y niñas, notas de ejemplo) y una IA simulada que proponía un área por nota. La API ya entrega el jardín, el catálogo y las observaciones del dataset, y el desafío E-1 pide que la IA proponga **nivel y manifestaciones del catálogo con su evidencia**, no un área. Este cambio es un primer paso (trabajo en curso) para que la web consuma la API en lo que ya responde de inmediato.

## What Changes

- La web lee de la API: niños y niñas del jardín (`GET /ninos`), salas (derivadas de ellos), catálogo (`GET /manifestaciones`), niveles de la ruta (`GET /niveles`, nuevo) y registros anteriores de cada niño o niña (`GET /ninos/:id/trayectoria`, que ahora incluye la lista de observaciones).
- La propuesta simulada cambia de forma: **nivel esperado para la edad y manifestaciones del catálogo real, cada una con una cita literal del texto**. La revisión permite subir o bajar el nivel (rotulado como estimación pedagógica), quitar manifestaciones y agregar otras del catálogo del nivel, con un máximo de 5. Sin evidencia suficiente, pide elegir al menos una.
- «Mi sala» y la ficha cuentan las áreas sin registros con las observaciones de la API más las notas de la sesión, y la ficha lista las observaciones del dataset entre los últimos registros. Las salas se rotulan «Sala A», «Sala B» a partir del código del dataset.
- Pantallas de carga y de error cuando la API no responde.
- La API trata las variables de entorno vacías como no definidas: con el `.env.example` copiado tal cual, no arrancaba.

**Sigue simulado**: el ingreso, la transcripción del audio, la lectura de la foto, la propuesta de la IA y el guardado de las notas nuevas, que viven en memoria. El procesamiento asíncrono (`POST /capturas` → borrador) queda para un cambio posterior; el componente de procesamiento decidirá cómo se asocia la captura al niño o niña.

**Supuestos**: la sala propia de la educadora es la primera del jardín, porque la API aún no la conoce (llegará con Cognito); se recuerda en el navegador. Las salas se muestran como «Sala A» a partir del código `SG-A`.

## Capabilities

### New Capabilities

- `registro-web-api`: la web obtiene de la API los datos del jardín, el catálogo y los registros anteriores, y la revisión de la nota trabaja con nivel y manifestaciones.

### Modified Capabilities

- `ficha-nino`: «Mi sala», el selector de sala y la ficha usan los niños, niñas, salas y observaciones de la API. Se modifican «Lista de la sala» y «Cambiar de sala» (la sala propia es la primera del jardín y las salas se rotulan «Sala A»), «Áreas de la ficha» (cuenta observaciones de la API y notas de la sesión, y un registro con varias áreas cuenta en cada una) y «Últimas notas del niño o niña» (incluye las observaciones del dataset como «Registro del jardín»). La capacidad aún no está archivada: la crean `ficha-nino-movil` y `cambiar-sala-movil`, que deben archivarse antes que este cambio.

## Impact

- API: `GET /niveles`, campo `observaciones` en la trayectoria (aditivo) y lectura de variables vacías. Contrato y cliente orval regenerados.
- Web: `apps/web/src/registro/` (`api.ts` y `propuesta.ts` nuevos; `datos.ts` sin datos inventados; revisión, ficha, «Mi sala», «Mis notas», panel de escritorio y reporte CSV con nivel y manifestaciones).
- Pruebas: MSW con fixtures sintéticos en la web; e2e de la API para `/niveles` y la trayectoria.
