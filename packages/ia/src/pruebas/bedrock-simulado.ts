import {
  ApplyGuardrailCommand,
  ConverseCommand,
  type ApplyGuardrailCommandOutput,
  type BedrockRuntimeClient,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { vi } from 'vitest';

/*
 * Cliente de Bedrock simulado: responde según el tipo de comando, en orden, sin red ni
 * credenciales. Si la respuesta en cola es un Error, lo lanza tal cual (como el SDK).
 */

type Respuesta<T> = T | Error;

export function crearClienteSimulado(
  respuestas: {
    guardrail?: Respuesta<ApplyGuardrailCommandOutput>[];
    converse?: Respuesta<ConverseCommandOutput>[];
  } = {},
) {
  const guardrail = [...(respuestas.guardrail ?? [])];
  const converse = [...(respuestas.converse ?? [])];
  const send = vi.fn(async (comando: unknown): Promise<unknown> => {
    const cola =
      comando instanceof ApplyGuardrailCommand
        ? guardrail
        : comando instanceof ConverseCommand
          ? converse
          : undefined;
    if (!cola) throw new Error('comando no simulado');
    const siguiente = cola.shift();
    if (siguiente === undefined) throw new Error('no quedan respuestas simuladas');
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  });
  const enviados = () => send.mock.calls.map(([comando]) => comando);
  return {
    cliente: { send } as unknown as Pick<BedrockRuntimeClient, 'send'>,
    send,
    comandosConverse: () =>
      enviados().filter((c): c is ConverseCommand => c instanceof ConverseCommand),
    comandosGuardrail: () =>
      enviados().filter((c): c is ApplyGuardrailCommand => c instanceof ApplyGuardrailCommand),
  };
}

function converse(content: unknown[]): ConverseCommandOutput {
  return {
    $metadata: {},
    output: { message: { role: 'assistant', content } },
    stopReason: 'end_turn',
  } as ConverseCommandOutput;
}

/** Respuesta del modelo que usa la herramienta `registrar_borrador`. */
export function respuestaHerramienta(input: unknown, toolUseId = 'uso-1'): ConverseCommandOutput {
  return converse([{ toolUse: { toolUseId, name: 'registrar_borrador', input } }]);
}

/** Respuesta del modelo solo con texto (sin herramienta). */
export function respuestaTexto(texto: string): ConverseCommandOutput {
  return converse([{ text: texto }]);
}

/** Respuesta sin contenido. */
export function respuestaVacia(): ConverseCommandOutput {
  return {
    $metadata: {},
    output: { message: { role: 'assistant', content: [] } },
  } as unknown as ConverseCommandOutput;
}

function guardrail(datos: Partial<ApplyGuardrailCommandOutput>): ApplyGuardrailCommandOutput {
  return { $metadata: {}, outputs: [], assessments: [], ...datos } as ApplyGuardrailCommandOutput;
}

export function guardrailAnonimiza(texto: string): ApplyGuardrailCommandOutput {
  return guardrail({ action: 'GUARDRAIL_INTERVENED', outputs: [{ text: texto }] });
}

export function guardrailSinCambios(): ApplyGuardrailCommandOutput {
  return guardrail({ action: 'NONE' });
}

export function guardrailSinTexto(): ApplyGuardrailCommandOutput {
  return guardrail({ action: 'GUARDRAIL_INTERVENED', outputs: [] });
}

/** El Guardrail bloqueó: su salida es el aviso configurado, no la nota. */
export function guardrailBloquea(): ApplyGuardrailCommandOutput {
  return guardrail({
    action: 'GUARDRAIL_INTERVENED',
    outputs: [{ text: 'La solicitud contiene información que no se puede procesar.' }],
    assessments: [
      {
        sensitiveInformationPolicy: {
          piiEntities: [{ type: 'NAME', match: 'Persona Ficticia', action: 'BLOCKED' }],
          regexes: [],
        },
      },
    ],
  });
}
