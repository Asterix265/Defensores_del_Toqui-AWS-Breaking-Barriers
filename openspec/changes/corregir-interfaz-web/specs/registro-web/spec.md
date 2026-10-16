# Spec Delta

## ADDED Requirements

### Requirement: Atrás dentro de la app
La web SHALL registrar en el historial del navegador cada cambio de pantalla (pestañas, ficha, nota y diálogo), de modo que el botón Atrás vuelva a la pantalla anterior de la app. Atrás SHALL NOT salir de la app mientras quede una pantalla anterior propia.

#### Scenario: Volver de la ficha en el celular
- **WHEN** la educadora abre «Mi sala», entra a la ficha de un niño o niña y presiona Atrás en el navegador
- **THEN** vuelve a «Mi sala» sin salir de la app

#### Scenario: Cerrar el diálogo en PC
- **WHEN** la educadora abre «Nueva nota» en el panel, sin captura en curso, y presiona Atrás
- **THEN** el diálogo se cierra y el panel queda en la pestaña donde estaba

### Requirement: Acciones de la nota siempre visibles
Cada paso de la nota SHALL desplazar su contenido dentro del espacio disponible y SHALL mantener visibles sus acciones principales, tanto en el diálogo de PC como en el celular.

#### Scenario: Revisión larga en PC
- **WHEN** la revisión de una nota de audio no cabe en el diálogo de PC
- **THEN** el contenido se desplaza y el botón «Está bien» sigue visible

### Requirement: Confirmar antes de perder una nota
Cerrar una nota con trabajo en curso (grabación, texto escrito, niño o niña por elegir o procesamiento) SHALL pedir confirmación antes de descartarla. Cerrar desde la revisión SHALL dejar la nota «Sin revisar» y avisarlo.

#### Scenario: Clic fuera del diálogo durante la grabación
- **WHEN** la educadora graba un audio en PC y hace clic fuera del diálogo
- **THEN** la app pregunta si quiere salir sin guardar y la grabación sigue si cancela

#### Scenario: Cerrar la revisión
- **WHEN** la educadora cierra la revisión de una nota y confirma la salida
- **THEN** la nota aparece en «Mis notas» como «Sin revisar»

### Requirement: Retomar notas sin revisar
La web SHALL permitir abrir las notas «Sin revisar» o «Con error» de la educadora y SHALL mostrar la misma revisión, que permite confirmar o borrar la nota.

#### Scenario: Retomar en el celular
- **WHEN** la educadora presiona una nota «Sin revisar» en «Mis notas» y confirma la revisión
- **THEN** la nota pasa a «Guardada»

#### Scenario: Retomar en PC
- **WHEN** la educadora tiene una nota «Sin revisar» y abre «Mis notas» en el panel
- **THEN** la nota aparece en «Por revisar» y abre la revisión en el diálogo

### Requirement: Texto de la revisión según el procesamiento
La revisión SHALL rotular el texto como «de ejemplo» solo cuando el procesamiento de audio o foto fue simulado. Los detalles técnicos del procesamiento SHALL quedar plegados por defecto.

#### Scenario: Transcripción real
- **WHEN** la nota de audio se transcribió con Amazon Transcribe y la clasificación no fue simulada
- **THEN** la revisión muestra «Lo que entendimos de tu audio» y no «Texto de ejemplo»

#### Scenario: Procesamiento simulado
- **WHEN** el procesamiento de una foto fue simulado
- **THEN** la revisión muestra «Texto de ejemplo (no es tu foto)»
