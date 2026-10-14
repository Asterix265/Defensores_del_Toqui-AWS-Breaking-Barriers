# Contexto de la hackatón y del desafío E-1

Documento de referencia rápida para el equipo y para agentes. Reúne la información del evento, el desafío E-1 de Fundación Integra y el dataset público. Las diferencias detalladas entre fuentes y el contrato de datos están en [contexto-desafio.md](contexto-desafio.md).

Preparado el 14 de octubre de 2026 a partir de:

- Página oficial del evento: <https://www.taurusmkt.com/breakingbarrierschile>, consultada el 14-10-2026.
- `bb-assets-e1-presentation.pptx`: texto extraído de las diapositivas. No se interpretó contenido exclusivamente visual.
- `dataset_e1_publico/`: README, diccionario, distribución y validación, ejemplos de trayectorias y CSV.

> En la máquina de preparación, los materiales estaban en `~/Downloads/` (`bb-assets-e1-presentation.pptx` y `dataset_e1_publico/`), no en `../Desafio/` como indica el README. Hay que copiarlos allí o actualizar esa ruta.

---

## 1. El evento: AWS Breaking Barriers Chile 2026

| Dato | Valor |
| --- | --- |
| Fechas | Miércoles 14 a viernes 16 de octubre de 2026, de 09:00 a 21:00 (hora de Chile) |
| Lugar | Universidad de Chile, FCFM, Av. Beauchef 851, Santiago |
| Formato | Hackatón presencial de 3 días; los equipos construyen herramientas con **IA generativa** para instituciones beneficiarias |
| Organizan | AWS, Universidad de Chile y Facultad de Ciencias Físicas y Matemáticas |
| Destino de la solución | Los prototipos ganadores se entregan a las instituciones, que pueden desplegarlos inicialmente con **créditos promocionales de AWS** |

### Cronograma

| Día | Hora | Hito |
| --- | --- | --- |
| Mié 14 | 09:00 | Acreditación |
|  | 10:00 | Inauguración |
|  | 11:00 | Presentación de desafíos y conformación de equipos |
|  | 21:00 | Cierre del día |
| Jue 15 | 09:00–21:00 | Desarrollo |
| Vie 16 | **10:15** | **Cierre del desarrollo** (*code freeze*) |
|  | 12:00 | Pre-evaluación técnica |
|  | 15:00 | Pitch de finalistas ante el jurado |
|  | 16:00 | Deliberación |
|  | 16:30 | Ceremonia de cierre |
|  | 17:30 | Cóctel |

Hay poco tiempo de desarrollo efectivo: la tarde del miércoles, el jueves completo y la mañana del viernes hasta las 10:15. La demo debe quedar estable antes de esa hora.

### Criterios de evaluación

| Criterio | Peso | Qué implica para nosotros |
| --- | ---: | --- |
| Innovación técnica | 25 % | Uso no trivial de IA generativa sobre observaciones y evidencia |
| Potencial de impacto social | 25 % | Vincular la demo con las horas de escritorio que se devuelven al aula |
| Factibilidad y sustentabilidad | 20 % | Arquitectura AWS simple, costo razonable y operable por Integra |
| Escalabilidad | 15 % | Pensar en más de 85.000 niños y niñas y más de 1.200 jardines |
| Calidad de la presentación | 15 % | Pitch claro, historia de la «tía» y demo en vivo |

La página no informa premios, tamaño de equipo, mentorías ni contacto. Los *workshops* previos (5, 6 y 8 de octubre: nube de AWS, Kiro IDE y «Construye tu primera app con IA», AI-DLC) ya ocurrieron.

### Otros desafíos del evento (fuera de nuestro foco)

- **Salud**, Hospital Clínico Dra. Eloísa Díaz La Florida: priorización clínica y gestión de boxes; copiloto de procesos BPMN.
- **Educación**, Fundación Integra: E-1, nuestro desafío; escucha en tiempo real de trabajadores; mapeo de beneficios estatales para familias.
- **Gobierno digital**, ChileAtiende: ruta personalizada de trámites ante eventos de vida.
- **Sustentabilidad**: CR2, detección temprana de tornados con el satélite GOES; CASE, rutas para flotas eléctricas.

La página describe E-1 como «Ruta de trayectoria de aprendizaje **a partir de videos de observación**». La presentación amplía las entradas a textos, fotos de notas, audios y videos.

---

## 2. Fundación Integra (presentación, diapositiva 2)

- Misión: «Construimos oportunidades para toda la vida, educando con calidad y cuidando a la primera infancia».
- Más de 85.000 niños, niñas y sus familias al año; más de 1.200 jardines y salas cuna.
- Más de 27.500 trabajadores, de los cuales el 98 % son mujeres.
- 60 % de la población atendida pertenece al segmento más vulnerable; 25 % de la matrícula pública de educación parvularia.
- Presencia en 320 comunas (95 %) y 36 años de trayectoria.

El contacto del referente de Integra aparece en la diapositiva 11 de la presentación. No se copia aquí.

---

## 3. Desafío E-1: «IA para el Desarrollo Infantil: de la Observación a la Acción»

Lema: **«Más tiempo para interacciones significativas»**.

### El dolor (diapositiva 6)

> La tía Mercedes, del Jardín Caracolitos de Chillán, no puede estar en la sala con Maite y Simón apoyando su desarrollo, porque está en su oficina sistematizando y procesando datos para entender en qué nivel de desarrollo están y cómo apoyarlos.

(En la diapositiva aparece como «Mecedes»; se asume una errata.)

- **Dato 1:** una tía demora en promedio **4 horas semanales** en documentar la información de su grupo.
- **Dato 2:** son más de **11.000 horas semanales** a nivel institucional.
- **Dato 3:** equivale al **10 %** del tiempo efectivo de trabajo semanal.

### Enunciado

> Crear una herramienta tecnológica que, usando recursos diversos de los niños y niñas generados por las tías (textos, fotos de notas que ya realizan como parte de su rutina, notas de audio, videos, etc.), pueda **sistematizar y evaluar** a cada niño o niña, **resguardando la integridad de la información sensible**.

### Rúbrica institucional (diapositiva 7)

- **10 núcleos de aprendizaje**; por ejemplo, Identidad y Autonomía.
- **8 niveles de desarrollo por núcleo**, con conducta esperada y conductas observables: 1 Comenzando, 2 Explorando, 3 Desarrollando, 4 Afianzando, 5 Integrando, 6 Ampliando, 7 Consolidando y 8 Profundizando.
- **3 niveles educativos**: sala cuna, nivel medio y transición.

La presentación no entrega el detalle de núcleos ni de conductas observables.

### Por qué importa (diapositivas 8 y 9)

- Primeros 1.000 días de vida: una ventana de oportunidad que no se repite.
- Valor esperado: identificar rezagos más rápido, aumentar el tiempo en sala y potenciar el desarrollo de cada niño o niña.
- Escalabilidad declarada: otras instituciones de educación parvularia en Chile, el primer ciclo escolar y Latinoamérica.

### KPI (diapositiva 10)

| KPI estrella | Línea base | Meta |
| --- | --- | --- |
| Horas de escritorio semanales dedicadas a documentación por tía | 4 h | 0 h |

La meta de 0 horas es aspiracional y pertenece al desafío; no es un resultado del proyecto. La demo debería **medir o estimar con un método explícito** cuánto tiempo ahorra y qué pasos siguen requiriendo a la educadora.

---

## 4. Dataset público E-1 (sintético)

Uso pedagógico: todos los registros son ficticios. La ruta de 9 niveles **no** es un instrumento clínico, diagnóstico, de tamizaje ni una evaluación validada. Su fecha de referencia es `2026-10-13`.

### Tablas

| Archivo | Filas | Contenido |
| --- | ---: | --- |
| `jardines.csv` | 20 | Nombre ficticio, comuna y región reales, salas y número de educadoras |
| `educadoras.csv` | 80 | 50 `educadora_parvulos` y 30 `tecnico_parvulos`; años de experiencia |
| `ninos.csv` | 500 | Fecha de nacimiento, sexo registrado, jardín, sala y fecha de ingreso |
| `ruta_niveles.csv` | 9 | Niveles con rango orientativo de edad en meses |
| `manifestaciones.csv` | 90 | Conductas observables: 9 niveles × 5 dominios × 2 |
| `observaciones.csv` | 2.950 | Niño o niña, educadora, fecha, `formato_captura`, `nivel_estimado` y `nota_breve` opcional |
| `observacion_manifestaciones.csv` | 8.850 | Tabla puente: cada observación tiene de 1 a 5 manifestaciones de su mismo nivel |
| `consolidado.json` | — | Vista anidada equivalente; añade `edad_meses_observacion` |

### Ruta sintética de 9 niveles (0 a 36 meses)

| Nivel | Nombre | Edad (meses) |
| ---: | --- | --- |
| 1 | Atención y regulación inicial | 0–2 |
| 2 | Interacción y control emergente | 2–4 |
| 3 | Alcance y exploración corporal | 4–6 |
| 4 | Sedestación y comunicación intencional | 6–9 |
| 5 | Movilidad y propósito | 9–12 |
| 6 | Autonomía funcional inicial | 12–18 |
| 7 | Representación y combinación inicial | 18–21 |
| 8 | Combinación y participación | 21–27 |
| 9 | Secuencias y autonomía creciente | 27–36 |

Dominios: `cognitivo`, `lenguaje_comunicacion`, `motor_fino`, `motor_grueso` y `socioemocional`. IDs de manifestación: `MAN-L<nivel>-<dominio>-<n>`; por ejemplo, `MAN-L01-CO-01`.

### Características útiles

- Formatos: `texto` 1.454, `video` 563, `audio` 494 y `foto` 439. Son **solo metadatos**: no hay archivos multimedia.
- 885 de 2.950 observaciones no tienen `nota_breve`.
- Observaciones por niño o niña: 60 tienen 1 o 2 registros por ingreso reciente; 440 tienen entre 4 y 9.
- Trayectorias: el 98,98 % de las transiciones no desciende; 25 niños o niñas tienen una baja acotada.
- Ventana temporal: del 2025-01-01 al 2026-10-13. Hay 16 regiones representadas.
- Los scripts `generador.py` y `validador.py` mencionados en el README **no** vienen en el zip.

---

## 5. Brechas e implicancias para el diseño

1. **La rúbrica y la ruta no coinciden.** Integra usa 10 núcleos × 8 niveles × 3 niveles educativos. El dataset usa 5 dominios × 9 niveles. Cualquier mapeo es una decisión del equipo y debe documentarse.
2. **Cobertura etaria.** El dataset cubre de 0 a 36 meses, es decir, sala cuna y nivel medio. No cubre el nivel de transición.
3. **No hay multimedia.** Para mostrar captura por audio, foto o video, la demo necesita entradas simuladas o sintéticas creadas por el equipo y documentadas como tales. Nunca se deben usar fotos ni audios reales de niños o niñas.
4. **Evidencia trazable.** Toda estimación de nivel debe mostrar qué observaciones y manifestaciones la respaldan. La falta de registro no implica falta de aprendizaje.
5. **No diagnosticar.** Se deben presentar «estimaciones pedagógicas» o «sugerencias para revisión de la educadora», no diagnósticos ni rezagos confirmados.
6. **Datos sensibles.** El enunciado exige resguardar la información de cada niño o niña. Esto debe aparecer en la arquitectura (cifrado, acceso mínimo y región) y en el pitch.
7. **Puntaje.** Innovación e impacto suman el 50 %. Una demo que convierta una nota de voz o una foto de cuaderno en observaciones vinculadas a manifestaciones, con trayectoria visible y tiempo ahorrado, aborda ambos criterios.

## 6. Decisiones pendientes

Siguen abiertas; se registrarán en un cambio OpenSpec, por ejemplo `definir-mvp-e1`:

- Flujo principal de la demo y criterios de aceptación.
- Mapeo, o no mapeo, entre la rúbrica de 8 niveles y la ruta de 9.
- Servicios AWS, modelo de IA, región, permisos, costos y limpieza de recursos.
- Método para estimar las horas ahorradas.
- Generación de entradas multimedia sintéticas para la demo.
