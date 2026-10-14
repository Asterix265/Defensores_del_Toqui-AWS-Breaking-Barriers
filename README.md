# Defensores del Toqui — AWS Breaking Barriers

Proyecto de la hackatón **AWS Breaking Barriers Chile 2026**, enfocado en Fundación Integra y el desafío **E-1: Ruta de Trayectoria de Aprendizaje**.

La presentación sitúa el evento entre el 14 y el 16 de octubre de 2026, en la Universidad de Chile, Beauchef 851, Santiago.

## Propósito

Devolver tiempo de aula a las educadoras reduciendo el trabajo de documentación y sistematización de observaciones, sin perder la trazabilidad del aprendizaje de cada niño o niña. La presentación denomina esta línea «IA para el Desarrollo Infantil: de la Observación a la Acción».

La línea base declarada en la presentación es de **4 horas semanales** de documentación por educadora; su meta aspiracional es llegar a **0 horas**. Estos valores describen el desafío, no resultados alcanzados por este proyecto.

## Estado inicial

Repositorio inicializado con OpenSpec **1.4.1**, documentación y habilidades locales para Codex y Claude Code. Todavía no se han definido el MVP, la arquitectura, los servicios AWS ni el stack de aplicación. No hay una aplicación ejecutable ni un despliegue configurado.

## Materiales del desafío

Los originales se mantienen en la carpeta hermana `../Desafio/`; no se copian al repositorio.

| Recurso | Ubicación relativa a este repositorio |
| --- | --- |
| Presentación de Integra | `../Desafio/bb-assets-e1-presentation.pptx` |
| Dataset público y documentación | `../Desafio/dataset_e1_publico/` |
| Diccionario | `../Desafio/dataset_e1_publico/diccionario_datos.md` |
| Distribución y validación publicada | `../Desafio/dataset_e1_publico/distribucion_y_validacion.md` |
| Ejemplos de trayectorias | `../Desafio/dataset_e1_publico/ejemplos_trayectorias.md` |

Portal proporcionado: [Fundación Integra — desafíos](https://d78v2swml9yu2.cloudfront.net/?inst=integra).

Quien clone solo este repositorio deberá obtener los materiales públicos y ubicarlos en una carpeta hermana `Desafio`, o documentar su ubicación alternativa. El [contexto del desafío](docs/contexto-desafio.md) resume las fuentes y sus diferencias.

## Dataset disponible

Datos sintéticos de uso pedagógico, con fecha de referencia **2026-10-13**. Se verificaron los conteos leyendo los siete CSV locales:

| Entidad | Registros |
| --- | ---: |
| Jardines | 20 |
| Personal observador | 80 |
| Niños y niñas | 500 |
| Niveles de la ruta sintética | 9 |
| Manifestaciones | 90 |
| Observaciones | 2.950 |
| Vínculos observación–manifestación | 8.850 |

`datos_publicos/consolidado.json` ofrece una vista anidada de los datos. Los formatos `texto`, `audio`, `foto` y `video` son metadatos: **no se entregan archivos multimedia**. La ausencia de un registro no implica ausencia de aprendizaje. La ruta sintética no es un instrumento clínico ni una evaluación validada.

## Trabajo con OpenSpec

Requisito: CLI `@fission-ai/openspec` (versión usada en esta inicialización: `1.4.1`). Si no está instalado:

```powershell
npm install -g @fission-ai/openspec@1.4.1
```

Desde la raíz del repositorio:

```powershell
openspec --version
openspec list
openspec list --specs
openspec new change "definir-mvp-e1"
```

El último comando inicia el siguiente cambio; no se ha ejecutado como parte de esta preparación. Completar su propuesta, especificaciones, diseño y tareas antes de implementar. Validarlo con:

```powershell
openspec validate definir-mvp-e1 --strict --no-interactive
```

La configuración y el contexto están en `openspec/config.yaml`. Las especificaciones consolidadas se guardan en `openspec/specs/`, los cambios en `openspec/changes/` y su historial en `openspec/changes/archive/`.

Claude dispone de comandos `/opsx:explore`, `/opsx:propose`, `/opsx:apply`, `/opsx:sync` y `/opsx:archive`. Codex dispone de las habilidades locales equivalentes en `.codex/skills/`; por ejemplo, `openspec-propose`. La instalación de comandos globales de Codex quedó impedida por permisos fuera del repositorio; las habilidades locales sí están presentes.

## Próximas decisiones

1. Acordar un flujo demostrable para la educadora y sus criterios de aceptación.
2. Resolver cómo representar la rúbrica institucional frente a la ruta sintética del dataset.
3. Definir arquitectura AWS, permisos, región y presupuesto según ese alcance.
4. Medir tiempo de documentación y trazabilidad con datos sintéticos; reportar resultados reales de la demo.

Las reglas de colaboración están en [AGENTS.md](AGENTS.md); [CLAUDE.md](CLAUDE.md) incorpora esas mismas reglas para Claude Code.
