import {
  ApplyGuardrailCommand,
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import type { BorradorEntrante } from '@toqui/shared';
import {
  ESQUEMA_HERRAMIENTA,
  INSTRUCCION_FOTO,
  NOMBRE_HERRAMIENTA,
  SISTEMA_EXTRACCION,
  mensajeExtraccion,
} from './prompt.js';
import {
  MINIMO_TEXTO,
  SIN_TEXTO,
  borradorInsuficiente,
  type ContextoExtraccion,
  type IaProvider,
} from './proveedor.js';
import { validarPropuesta } from './validacion.js';

export interface OpcionesBedrock {
  /** ID o inference profile del modelo de extracción (p. ej. `us.anthropic.claude-sonnet-5-5`). */
  modelo: string;
  /** Guardrail que anonimiza datos personales antes de enviar el texto al modelo. */
  guardrail?: { id: string; version: string };
  region?: string;
  cliente?: BedrockRuntimeClient;
}

/** Formatos de imagen que acepta Claude en Bedrock. */
export type FormatoImagen = 'jpeg' | 'png';

/** Límite de Bedrock para una imagen en Converse. */
export const TAMANO_MAXIMO_IMAGEN = 3.75 * 1024 * 1024;

/** Intentos de extracción: el segundo recibe los problemas del primero (D7). */
const INTENTOS = 2;

/**
 * Proveedor real: Guardrail (anonimiza) → Claude con salida estructurada por herramienta →
 * validación zod, con un reintento y luego evidencia insuficiente. Nunca recibe el id ni el
 * nombre del niño o niña: solo la nota, la edad y el catálogo.
 */
export class ProveedorBedrock implements IaProvider {
  readonly nombre = 'bedrock';
  readonly modelo: string;
  private readonly cliente: BedrockRuntimeClient;
  private readonly guardrail: OpcionesBedrock['guardrail'];

  constructor(opciones: OpcionesBedrock) {
    this.modelo = opciones.modelo;
    this.guardrail = opciones.guardrail;
    this.cliente = opciones.cliente ?? new BedrockRuntimeClient({ region: opciones.region });
  }

  /** Reemplaza nombres, contactos y RUT por marcadores como `{NAME}`. Sin Guardrail, no cambia. */
  async anonimizar(texto: string): Promise<string> {
    if (!this.guardrail) return texto;
    const respuesta = await this.cliente.send(
      new ApplyGuardrailCommand({
        guardrailIdentifier: this.guardrail.id,
        guardrailVersion: this.guardrail.version,
        source: 'INPUT',
        content: [{ text: { text: texto } }],
      }),
    );
    if (respuesta.action !== 'GUARDRAIL_INTERVENED') return texto;
    return respuesta.outputs?.map((o) => o.text ?? '').join('') || texto;
  }

  async extraer(texto: string, contexto: ContextoExtraccion): Promise<BorradorEntrante> {
    const textoFuente = (await this.anonimizar(texto.trim())).trim();
    if (textoFuente.length < MINIMO_TEXTO || textoFuente === SIN_TEXTO) {
      return borradorInsuficiente(textoFuente, this.nombre, this.modelo);
    }

    const mensajes: Message[] = [
      { role: 'user', content: [{ text: mensajeExtraccion(textoFuente, contexto) }] },
    ];
    for (let intento = 1; intento <= INTENTOS; intento++) {
      const respuesta = await this.cliente.send(
        new ConverseCommand({
          modelId: this.modelo,
          system: [{ text: SISTEMA_EXTRACCION }],
          messages: mensajes,
          inferenceConfig: { maxTokens: 1500 },
          toolConfig: {
            tools: [
              {
                toolSpec: {
                  name: NOMBRE_HERRAMIENTA,
                  description:
                    'Registra el borrador de la observación para que la educadora lo revise',
                  inputSchema: { json: ESQUEMA_HERRAMIENTA as never },
                },
              },
            ],
            // Los modelos recientes no aceptan forzar la herramienta: el sistema lo exige.
            toolChoice: { auto: {} },
          },
        }),
      );
      const contenido = respuesta.output?.message?.content ?? [];
      const uso = contenido.find((b) => b.toolUse)?.toolUse;
      const resultado = uso
        ? validarPropuesta(uso.input, textoFuente, contexto)
        : { ok: false as const, problemas: ['no se llamó a la herramienta'] };
      if (resultado.ok) {
        return { ...resultado.borrador, proveedor: this.nombre, modelo: this.modelo };
      }
      // Sin contenido no hay turno del asistente que agregar: se repite la misma solicitud.
      if (intento === INTENTOS || contenido.length === 0) continue;
      const correccion = `El borrador no es válido: ${resultado.problemas.join('; ')}. Corrígelo y vuelve a llamar a la herramienta ${NOMBRE_HERRAMIENTA}.`;
      mensajes.push(
        { role: 'assistant', content: contenido },
        {
          role: 'user',
          content: uso?.toolUseId
            ? [
                {
                  toolResult: {
                    toolUseId: uso.toolUseId,
                    status: 'error',
                    content: [{ text: correccion }],
                  },
                },
              ]
            : [{ text: correccion }],
        },
      );
    }
    return borradorInsuficiente(textoFuente, this.nombre, this.modelo);
  }

  /** Lectura de una foto con Claude multimodal: describe lo observable, sin nombres. */
  async describirFoto(imagen: Uint8Array, formato: FormatoImagen): Promise<string> {
    if (imagen.byteLength > TAMANO_MAXIMO_IMAGEN) {
      throw new Error(
        `La foto pesa ${(imagen.byteLength / 1024 / 1024).toFixed(1)} MB; el máximo es 3,75 MB`,
      );
    }
    const contenido: ContentBlock[] = [
      { image: { format: formato, source: { bytes: imagen } } },
      { text: INSTRUCCION_FOTO },
    ];
    const respuesta = await this.cliente.send(
      new ConverseCommand({
        modelId: this.modelo,
        messages: [{ role: 'user', content: contenido }],
        inferenceConfig: { maxTokens: 400 },
      }),
    );
    const texto = (respuesta.output?.message?.content ?? [])
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    return texto || SIN_TEXTO;
  }
}
