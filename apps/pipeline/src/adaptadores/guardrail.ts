import { ApplyGuardrailCommand, type BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { ErrorPermanente } from '../errores.js';
import type { Anonimizador } from '../puertos.js';

/**
 * `ApplyGuardrail` con `toqui-prod-pii` (modo ANONYMIZE): nombres, correos, teléfonos,
 * direcciones y RUT pasan a marcadores como `{NAME}`.
 */
export class AnonimizadorGuardrail implements Anonimizador {
  constructor(
    private readonly bedrock: BedrockRuntimeClient,
    private readonly guardrail: { id: string; version: string },
  ) {}

  async anonimizar(texto: string): Promise<string> {
    const respuesta = await this.bedrock.send(
      new ApplyGuardrailCommand({
        guardrailIdentifier: this.guardrail.id,
        guardrailVersion: this.guardrail.version,
        source: 'INPUT',
        content: [{ text: { text: texto } }],
      }),
    );
    if (respuesta.action !== 'GUARDRAIL_INTERVENED') return texto;

    // Si el Guardrail bloquea en vez de anonimizar, no se debe seguir con el texto original.
    const bloqueado = respuesta.assessments?.some(
      (a) =>
        a.sensitiveInformationPolicy?.piiEntities?.some((e) => e.action === 'BLOCKED') ||
        a.sensitiveInformationPolicy?.regexes?.some((e) => e.action === 'BLOCKED'),
    );
    const salida = respuesta.outputs?.map((o) => o.text ?? '').join('') ?? '';
    if (bloqueado || !salida.trim()) {
      throw new ErrorPermanente('La nota contiene información que no se puede procesar');
    }
    return salida;
  }
}
