# Spec Delta

La propuesta deja de calcularse en la web y viene del borrador de la API. Modifica un requisito que crea `conectar-web-api`.

## MODIFIED Requirements

### Requirement: Propuesta de nivel y manifestaciones
La revisión de una nota SHALL mostrar el nivel estimado y las manifestaciones con su cita que propone el borrador de la API, con el nivel rotulado como estimación pedagógica y no como diagnóstico. La educadora SHALL poder cambiar el nivel, quitar manifestaciones y agregar otras del nivel elegido, hasta 5. Confirmar SHALL requerir al menos una manifestación, y todas SHALL ser del nivel confirmado. Si el borrador trae evidencia insuficiente o la captura terminó con error, la revisión SHALL partir sin propuesta.

#### Scenario: Propuesta con evidencia
- **WHEN** la educadora escribe «Apiló tres bloques y aplaudió.» para un niño de 20 meses
- **THEN** la revisión muestra el nivel 7 y una manifestación de Motor fino del nivel 7 con la cita del texto, según el borrador de la API

#### Scenario: Evidencia insuficiente
- **WHEN** el borrador trae evidencia insuficiente
- **THEN** la revisión lo indica, abre el catálogo del nivel y no permite confirmar hasta elegir una manifestación

#### Scenario: Cambio de nivel
- **WHEN** la educadora sube el nivel con manifestaciones ya elegidas
- **THEN** se quitan las manifestaciones del nivel anterior
