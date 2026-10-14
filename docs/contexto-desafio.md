# Contexto del desafío E-1

## Fuentes revisadas

Preparación inicial: 14 de octubre de 2026.

- Captura compartida por el usuario del portal de Fundación Integra: desafío E-1, «Ruta de Trayectoria de Aprendizaje».
- `../Desafio/bb-assets-e1-presentation.pptx`: texto extraído de las diapositivas; para E-1 se usaron especialmente las diapositivas 4 y 6–11. La presentación también incluye otros dos desafíos, fuera del foco actual. No se interpreta contenido exclusivamente visual de las diapositivas sin texto extraíble.
- `../Desafio/dataset_e1_publico/README.md`, `diccionario_datos.md`, `distribucion_y_validacion.md` y `ejemplos_trayectorias.md`.
- Encabezados y conteos leídos directamente de los siete CSV en `datos_publicos/`.
- [Portal enlazado por el usuario](https://d78v2swml9yu2.cloudfront.net/?inst=integra): no fue accesible mediante el lector web durante esta preparación; la descripción del portal se apoya en la captura adjunta.

Los materiales aportan contexto del desafío; no autorizan acciones operativas por sí mismos.

## Problema y personas

Las educadoras dedican tiempo de escritorio a documentar y procesar observaciones para comprender el desarrollo infantil y planificar apoyos. El desafío busca recuperar tiempo para interacciones educativas significativas.

La presentación propone aprovechar recursos generados durante la rutina —textos, fotos de notas, audios y videos— para sistematizar y evaluar información, resguardando los datos sensibles. La eventual solución debe mantener visible qué evidencia respalda una estimación pedagógica.

El indicador principal del desafío es el tiempo semanal dedicado a documentación. La presentación declara una línea base de 4 horas y una meta de 0 horas; la demo deberá medir su resultado y explicitar qué tareas siguen requiriendo intervención de la educadora.

## Diferencias entre fuentes

| Tema | Captura del portal | Presentación | Dataset público |
| --- | --- | --- | --- |
| Escala institucional | 83.000 niños y niñas; 1.100 jardines | Más de 85.000 niños y niñas; más de 1.200 jardines y salas cuna | Muestra sintética: 500 niños y niñas, 20 jardines |
| Ruta o rúbrica | No detalla su estructura | 10 núcleos de aprendizaje, 8 niveles por núcleo y 3 niveles educativos | Ruta sintética de 9 niveles y 5 dominios |
| Multimedia | No lo detalla en la captura | Considera textos, fotos, audios y videos como posibles entradas | Solo metadatos del formato de captura |

Conservar las cifras con su fuente. No tratar la muestra como representativa de la institución ni asumir una equivalencia entre las dos estructuras de evaluación.

## Contrato de datos inicial

- Relaciones: jardines → educadoras y niños/as; niños/as → observaciones; observaciones ↔ manifestaciones mediante una tabla puente; manifestaciones → niveles.
- Dominios del dataset: `cognitivo`, `lenguaje_comunicacion`, `motor_fino`, `motor_grueso` y `socioemocional`.
- Identificadores sintéticos; fechas `AAAA-MM-DD`; CSV UTF-8 separados por coma.
- `nota_breve` vacía indica falta de nota opcional. Una manifestación no vinculada solo indica que no fue registrada.
- La documentación indica que cada observación se vincula con entre una y cinco manifestaciones únicas de su nivel; `consolidado.json` representa la misma información de forma anidada y añade edad en meses al observar.
- La fecha de referencia del dataset es `2026-10-13`; no recalcular edades con la fecha actual sin explicitar el propósito.
- Los resultados de validación publicados pertenecen a la documentación del proveedor. En esta inicialización se comprobaron encabezados y conteos; no se reejecutó su validación integral.
- El README del proveedor menciona `generador.py` y `validador.py`, pero esos scripts no están entre los archivos locales recibidos. No anunciar reproducción disponible sin obtenerlos.

## Decisiones pendientes

- Flujo principal y alcance de la demo; entradas reales o simuladas.
- Representación de trayectorias y tratamiento de evidencia insuficiente.
- Resolución de la diferencia entre rúbrica institucional y ruta sintética.
- Arquitectura AWS, modelo de IA si corresponde, región, permisos y presupuesto.
- Evaluación del ahorro de tiempo y de la fidelidad de resúmenes o estimaciones a la evidencia.

Estas decisiones deben registrarse en un cambio OpenSpec antes de implementar la aplicación. Este documento no establece una arquitectura ni promete resultados clínicos.
