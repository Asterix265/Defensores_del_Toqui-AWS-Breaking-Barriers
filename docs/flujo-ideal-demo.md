# Flujo ideal de la demo (E-1)

Lo que el equipo espera mostrar, comparado con lo que hay hoy. Redactado por la Persona D (web) el 16-10-2026 como insumo para iterar después del despliegue. **No es una especificación aprobada**: lo que entre al código pasa antes por un cambio OpenSpec.

Fuentes: FAQ de Integra (`../dataset_e1_nucleos_2026/fuentes/faq_e1.json`), dataset por núcleos de Codex (`../dataset_e1_nucleos_2026/`) y revisión de `main` y de la base local del 16-10-2026.

Estado: **existe** (probado en local), **simulado** (funciona con IA `fake` o con un texto de ejemplo), **falta** o **por verificar** (lo reportó alguien, pero no se revisó en el código).

## Decisiones para la hackatón

| Tema | Decisión | Fuente |
| --- | --- | --- |
| Quién registra | «Tía» = educadora de párvulos o asistente: un solo tipo de usuario (`educadora`), con los mismos permisos | Equipo; el FAQ dice que ambas observan |
| Quién confirma | La misma persona que registró | Equipo |
| Directora | Solo consulta su jardín en la demo; no registra | Equipo (el FAQ permite que registre, con baja frecuencia) |
| Salas | La tía consulta y registra en cualquier sala de su jardín; por defecto, la suya | Equipo |
| Varios niños o niñas | Una captura que menciona a varios se divide en **una nota por niño o niña**; cada una es evidencia por separado | Equipo; el FAQ dice que el post-it es individual |
| Nivel de la ficha | Lo **calcula el sistema** con las observaciones confirmadas, por núcleo | Equipo; el FAQ dice que el nivel es por núcleo |
| Núcleos y niveles | 8 núcleos con 8 niveles cada uno (por ejemplo, Identidad y Autonomía). El modelo de datos se está cambiando | Equipo; FAQ; dataset por núcleos |
| Alertas de rezago | En la web, «para revisar»: 2 niveles o más bajo la mediana de su sala y nivel educativo en un núcleo, con al menos 3 comparables. Estimación pedagógica, no diagnóstico | Equipo; FAQ (rezago relativo) |
| Nivel general | **Promedio simple** de los núcleos con nivel: todos pesan igual y los núcleos sin registros no cuentan. El de la sala es el promedio simple de los niños y niñas con nivel. No hay pesos por núcleo ni es una ponderación clínica | Equipo (decisión del 16-10-2026); FAQ (H4.4) |

Núcleos del dataset por núcleos: Identidad y Autonomía (IA), Convivencia y Ciudadanía (CC), Corporalidad y Movimiento (CM), Lenguaje Verbal (LV), Lenguajes Artísticos (LA), Exploración del Entorno Natural (EN), Comprensión del Entorno Sociocultural (ES) y Pensamiento Matemático (PM). Niveles educativos: Sala Cuna (0–24 meses), Nivel Medio (24–48) y Transición (48–72). Solo la rúbrica IA viene de Integra; las otras siete son propuestas sintéticas.

## Historias de usuario

Prioridad: **Demo** (mejora lo que se muestra antes de las 10:15), **Pitch** (se cuenta como hoja de ruta), **Futuro**.

### 1. Ingreso y sala

**H1.1** Como tía, quiero ingresar con mi correo y ver mi sala, para empezar a registrar sin buscarla.
- Criterio: al entrar, la sala por defecto es la de `/me`. Cerrar sesión borra los datos del jardín.
- Estado: existe (Cognito). Por verificar en producción que la sala venga de `/me` y no del mock (`conectar-web-api 3.3`). Prioridad: Demo.

**H1.2** Como tía, quiero cambiar de sala dentro de mi jardín, para registrar cuando apoyo en otra sala.
- Criterio: solo salas del jardín del token; una sala de otro jardín responde 403.
- Estado: existe (selector de sala). Prioridad: Demo.

**H1.3** Como directora, quiero ver todas las salas de mi jardín y sus notas, sin registrar.
- Estado: existe para consultar; registrar es solo de `educadora`, lo que coincide con la decisión. En escritorio, la directora parte en «Vista general»: una fila por sala con niños y niñas, edades, nivel promedio simple, cuántos quedan para revisar, sin nivel y notas de 7 días, y descarga CSV. Prioridad: Demo.

### 2. Captura

**H2.1** Como tía, quiero registrar una observación por texto, voz o foto de un post-it, para no tener que transcribir a mano.
- Criterio: la voz pasa por Transcribe y la foto por Textract; el texto resultante se muestra en la revisión.
- Estado: en local existe la subida a S3, con un texto de ejemplo en lugar de la transcripción. En producción, la Lambda `proceso` está en el código y aún no se despliega. Textract solo lee manuscrito en inglés: para notas en español, usar texto impreso o `LECTOR_FOTO=ia`. Prioridad: Demo.

**H2.2** Como tía, quiero que la IA proponga núcleo, nivel y la frase que lo respalda, para solo revisar.
- Criterio: cada manifestación propuesta trae una cita literal de la nota; sin respaldo, el borrador queda con `evidenciaInsuficiente` y no se inventa nada.
- Estado: simulado (`fake` por palabras clave); Claude está pendiente (`cola-ia-y-amplify 4.2`). Prioridad: Demo.

**H2.3** Como tía, quiero que una nota que menciona a varios niños o niñas se divida en una nota por cada uno, para registrar una actividad grupal de una vez.
- Criterio: la revisión muestra una propuesta por niño o niña; cada una se confirma o descarta por separado.
- Estado: falta (hoy una captura tiene un solo `idNino`). Prioridad: Pitch.

**H2.4** Como tía, quiero que el sistema reconozca el nombre del niño o niña en la nota y lo marque, para no elegirlo a mano.
- Criterio: se compara con la lista de la sala (si hay nombres repetidos, con los apellidos). La propuesta la confirma la tía.
- Restricción: el Guardrail borra los nombres antes de que el texto llegue a Claude. La detección tiene que hacerse antes de anonimizar, contra la lista de la sala, sin mandar los nombres al modelo.
- Estado: falta. Prioridad: Pitch.

### 3. Revisión

**H3.1** Como tía, quiero aceptar, cambiar el nivel o agregar y quitar manifestaciones antes de guardar, porque la decisión es mía.
- Criterio: el nivel se rotula como «estimación pedagógica» y la corrección queda guardada.
- Estado: existe en el celular. Por verificar: en escritorio no se puede confirmar. Prioridad: Demo.

**H3.2** Como tía, quiero que, si la IA no encuentra evidencia, se me diga claramente que elija yo o descarte la nota.
- Criterio: un mensaje explícito y el selector del catálogo abierto; la opción de descartar a la vista.
- Estado: hoy el botón de confirmar queda deshabilitado sin explicación, y la nota parece no crearse. Prioridad: Demo.

### 4. Ficha del niño o niña

**H4.1** Como tía, quiero ver en la ficha lo que yo escribí en cada nota y, debajo, las manifestaciones asociadas.
- Estado: hoy la ficha muestra primero el `textoObservable` del catálogo y deja la nota en segundo plano (`apps/web/src/registro/areas.ts`, `registroDeObservacion`). Prioridad: Demo.

**H4.2** Como tía, quiero ver el nivel de cada núcleo y las observaciones que lo justifican, para argumentar el nivel con evidencia.
- Criterio: nivel calculado a partir de las observaciones confirmadas del núcleo; al tocarlo, se ven las notas que lo respaldan. Sin observaciones en el periodo: «sin registros», nunca «no logrado».
- Estado: falta. Hoy el nivel va en cada observación (`nivel_estimado`) y la ficha cuenta notas por área en los últimos 30 días. Requiere decidir la regla de cálculo (ver «Pendiente»). Prioridad: Demo, en su versión mínima.

**H4.3** Como tía, quiero ver la evolución del niño o niña en el tiempo.
- Estado: existe parcialmente (`GET /ninos/:id/trayectoria`). Prioridad: Demo.

**H4.4** Como tía, quiero un nivel general del niño o niña (promedio de los núcleos, según el FAQ).
- Criterio: promedio simple de los núcleos con nivel, con igual peso (ver «Decisiones»), rotulado «promedio simple» en la interfaz y en el CSV (`nivel_promedio_simple`).
- Estado: existe en las tarjetas de «Mi sala» en escritorio (`apps/web/src/registro/niveles.ts`). El nivel de cada núcleo sale de la valoración más reciente con nivel o, sin ella, de la observación más reciente del núcleo: es una regla provisional mientras se decide H4.2. La ficha sigue sin mostrar niveles. Prioridad: Demo.

### 5. Sala y jardín

**H5.1** Como tía, quiero ver qué niños o niñas y qué núcleos tienen pocas notas, para saber a quién observar.
- Estado: hay un resumen por área de 30 días en la ficha; falta la vista de la sala (`definir-mvp-e1 5.4`, Persona E). Prioridad: Demo si alcanza.

**H5.2** Como tía, quiero una alerta cuando un niño o niña queda por debajo de la mayoría de su sala en un núcleo. Rezago relativo según el FAQ: si 8 de 10 están en el nivel 5 y 2 en el nivel 2, se alerta por esos 2.
- Estado: existe en «Mi sala» en escritorio: la tarjeta se resalta «para revisar» con los núcleos afectados y cada sala muestra sus métricas. Si no carga la trayectoria de algún niño o niña, la sala se marca con datos incompletos, el rezago no se calcula y el CSV queda bloqueado hasta reintentar. Prioridad: Demo.

**H5.3** Como directora, quiero comparar salas equivalentes de mi jardín (por ejemplo, las de nivel medio) y ver cuál va más rezagada.
- Estado: parcial. «Vista general» muestra todas las salas lado a lado con sus métricas; falta filtrar por nivel educativo. Prioridad: Pitch.

### 6. Configuración y privacidad

**H6.1** Como institución, quiero cargar la rúbrica con la cantidad de núcleos y de niveles que corresponda (hoy 8 y 8; mañana podrían ser 10 y 9), sin cambiar el código.
- Estado: en cambio. El modelo actual tiene 5 dominios y 9 niveles fijos, y la ruta cubre solo de 0 a 36 meses. Prioridad: Pitch (es el argumento de escalabilidad).

**H6.2** Como institución, quiero cargar a futuro los «pasos a seguir» de cada nivel. Prioridad: Futuro.
- Mientras tanto, la ficha muestra una retroalimentación por área a partir de la nota más reciente de la tía: la cita de lo que anotó, lo que evidencia y un próximo paso de la rúbrica que depende de esa nota (afianzar, completar o avanzar; `apps/web/src/registro/sugerencias.ts`). Es una sugerencia, no una evaluación, y no muestra niveles.

**H6.3** Como apoderado, quiero que un audio, una foto o un video se usen solo para extraer la nota y después se borren.
- Estado: S3 los borra a los 7 días, y el texto original se vacía de la base al mismo plazo. El FAQ pide borrar la grabación apenas se extrae la información. Prioridad: Pitch.

## Pendiente de decidir

- Regla de cálculo del nivel por núcleo (H4.2): por ejemplo, el nivel más alto con al menos N observaciones confirmadas, o el de la observación más reciente. Lo decide el equipo con E; Integra dice que se decide «más por la conducta observable que por un número fijo de observaciones».
- Cómo se migran las 2.950 observaciones del dataset original al modelo de 8 núcleos, o si la demo usa solo el dataset por núcleos.
- Edad: la ruta actual termina a los 36 meses y en `JAR-0001` hay niños y niñas de 37 y 40 meses.
