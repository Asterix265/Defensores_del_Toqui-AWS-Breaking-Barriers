## Purpose

Dar contexto a la clasificación de la IA con la memoria de las decisiones de las educadoras de cada jardín y con una base de conocimiento vectorial del catálogo, sin reentrenar modelos ni exponer identificadores personales.

## ADDED Requirements

### Requirement: Registro de la decisión en la memoria
Cuando una educadora confirma o corrige un borrador, el sistema SHALL guardar en la memoria el texto anonimizado de la captura junto con el nivel y las manifestaciones finales, asociados a su jardín.

#### Scenario: Corrección guardada
- **WHEN** una educadora corrige el nivel o las manifestaciones de un borrador y confirma
- **THEN** la memoria contiene una entrada de esa captura con la decisión final y el id del jardín

#### Scenario: Descarte
- **WHEN** una educadora descarta un borrador
- **THEN** no se agrega ninguna entrada a la memoria

#### Scenario: Memoria no disponible
- **WHEN** la memoria no responde al confirmar
- **THEN** la confirmación igual se guarda y responde con éxito, y el fallo queda registrado en los logs

### Requirement: Uso de la memoria en la clasificación
La clasificación SHALL incluir como ejemplos hasta 5 entradas de la memoria del mismo jardín parecidas a la captura, y el borrador SHALL informar cuántas usó.

#### Scenario: Casos parecidos en el jardín
- **WHEN** el jardín tiene decisiones previas parecidas a la nota
- **THEN** la clasificación usa como máximo 5 y el borrador informa la cantidad usada

#### Scenario: Otro jardín
- **WHEN** solo otro jardín tiene decisiones parecidas
- **THEN** la clasificación no las usa y el borrador informa 0 ejemplos

### Requirement: Base de conocimiento del catálogo
El sistema SHALL mantener una base de conocimiento consultable por similitud con el catálogo de manifestaciones y la descripción de dominios y niveles del dataset sintético, y la clasificación SHALL usar los fragmentos recuperados como contexto.

#### Scenario: Consulta durante la clasificación
- **WHEN** se clasifica una nota
- **THEN** la solicitud al modelo incluye fragmentos recuperados de la base de conocimiento, y las manifestaciones del borrador siguen limitadas a las del catálogo de la ruta

#### Scenario: Base de conocimiento no disponible
- **WHEN** la base de conocimiento no responde
- **THEN** la clasificación continúa con el catálogo del mensaje y el borrador se entrega igual

### Requirement: Sin identificadores personales en memoria ni conocimiento
La memoria y la base de conocimiento SHALL NOT almacenar nombres, RUT ni el id del niño o niña. El texto guardado SHALL ser el anonimizado por el filtro de información personal.

#### Scenario: Nota con nombre propio
- **WHEN** la nota original menciona el nombre del niño o niña
- **THEN** la entrada en la memoria contiene el texto con el nombre anonimizado y no incluye `id_nino`

### Requirement: Sin equivalencia con la rúbrica institucional
La base de conocimiento SHALL contener solo la ruta sintética de 9 niveles del dataset y SHALL NOT presentar equivalencias con la rúbrica institucional de 8 niveles.

#### Scenario: Contenido cargado
- **WHEN** se carga la base de conocimiento
- **THEN** sus documentos provienen del catálogo y de las descripciones del dataset sintético, con su procedencia indicada
