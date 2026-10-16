import {
  ApplyGuardrailCommand,
  ConverseCommand,
  type ApplyGuardrailCommandOutput,
  type BedrockRuntimeClient,
  type ContentBlock,
  type ConverseCommandOutput,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import type { BorradorEntrante } from '@toqui/shared';
import { mapearCita } from './citas.js';
import { ErrorIa } from './errores.js';
import { normalizarTexto } from './normalizacion.js';
import {
  HERRAMIENTA_BORRADOR,
  INSTRUCCION_FOTO,
  mensajeExtraccion,
  NOMBRE_HERRAMIENTA,
  SISTEMA_EXTRACCION,
} from './prompt.js';
import {
  borradorInsuficiente,
  entregar,
  SIN_TEXTO,
  textoSinEvidencia,
  validarImagen,
  type ContextoExtraccion,
  type FormatoImagen,
  type IaProvider,
} from './proveedor.js';
import { validar } from './validacion.js';

export interface OpcionesBedrock {
  cliente: Pick<BedrockRuntimeClient, 'send'>;
  modelo: string;
  /** Sin Guardrail la nota llega al modelo tal cual (solo desarrollo, `sinGuardrail: true`). */
  guardrail?: { id: string; version: string };
}

/** Resultado de revisar una respuesta del modelo. */
type Intento =
  | { tipo: 'valido'; borrador: BorradorEntrante }
  | { tipo: 'insuficiente' }
  | { tipo: 'invalido'; problemas: string[]; respuesta: Message };

/** Algún filtro del Guardrail bloqueó en vez de anonimizar: su salida es un aviso, no la nota. */
function bloqueado(respuesta: ApplyGuardrailCommandOutput): boolean {
  return JSON.stringify(respuesta.assessments ?? []).includes('"action":"BLOCKED"');
}

/** Mensaje con los problemas del intento: `toolResult` por cada `toolUse`, o texto si no hubo. */
function mensajeProblemas(respuesta: Message, problemas: string[]): Message {
  const texto = `La propuesta no es válida:\n- ${problemas.join('\n- ')}\nCorrígela y responde de nuevo con la herramienta ${NOMBRE_HERRAMIENTA}.`;
  const usos = (respuesta.content ?? []).flatMap((b) => (b.toolUse ? [b.toolUse] : []));
  const content: ContentBlock[] = usos.length
    ? usos.map((uso) => ({
        toolResult: { toolUseId: uso.toolUseId, status: 'error', content: [{ text: texto }] },
      }))
    : [{ text: texto }];
  return { role: 'user', content };
}

/**
 * Guardrail → Claude con herramienta → validación → un reintento → evidencia insuficiente.
 * Los errores del SDK se propagan sin envolver para que Step Functions los reintente.
 */
export class ProveedorBedrock implements IaProvider {
  readonly nombre = 'bedrock' as const;
  private readonly cliente: OpcionesBedrock['cliente'];
  private readonly modelo: string;
  private readonly guardrail: OpcionesBedrock['guardrail'];

  constructor(opciones: OpcionesBedrock) {
    this.cliente = opciones.cliente;
    this.modelo = opciones.modelo;
    this.guardrail = opciones.guardrail;
  }

  async extraer(texto: string, contexto: ContextoExtraccion): Promise<BorradorEntrante> {
    const original = normalizarTexto(texto);
    if (textoSinEvidencia(original)) return this.insuficiente(original);

    const anonimo = this.guardrail ? await this.anonimizar(original, this.guardrail) : original;
    const inicial: Message[] = [
      { role: 'user', content: [{ text: mensajeExtraccion(anonimo, contexto) }] },
    ];
    const primero = this.revisar(await this.conversar(inicial), anonimo, original, contexto);
    if (primero.tipo === 'valido') return primero.borrador;
    if (primero.tipo === 'insuficiente') return this.insuficiente(original);

    const reintento: Message[] = [
      ...inicial,
      primero.respuesta,
      mensajeProblemas(primero.respuesta, primero.problemas),
    ];
    const segundo = this.revisar(await this.conversar(reintento), anonimo, original, contexto);
    return segundo.tipo === 'valido' ? segundo.borrador : this.insuficiente(original);
  }

  async normalizarFoto(imagen: Uint8Array, formato: FormatoImagen): Promise<string> {
    validarImagen(imagen, formato);
    const respuesta = await this.cliente.send(
      new ConverseCommand({
        modelId: this.modelo,
        messages: [
          {
            role: 'user',
            content: [
              { image: { format: formato, source: { bytes: imagen } } },
              { text: INSTRUCCION_FOTO },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 300 },
      }),
    );
    const bloques = respuesta.output?.message?.content ?? [];
    return normalizarTexto(bloques.map((b) => b.text ?? '').join(' ')) || SIN_TEXTO;
  }

  private insuficiente(textoFuente: string): BorradorEntrante {
    return borradorInsuficiente(textoFuente, 'bedrock', this.modelo);
  }

  /** Falla cerrada: sin un texto anonimizado utilizable, la nota no llega al modelo. */
  private async anonimizar(
    texto: string,
    guardrail: NonNullable<OpcionesBedrock['guardrail']>,
  ): Promise<string> {
    const respuesta = await this.cliente.send(
      new ApplyGuardrailCommand({
        guardrailIdentifier: guardrail.id,
        guardrailVersion: guardrail.version,
        source: 'INPUT',
        content: [{ text: { text: texto } }],
      }),
    );
    if (respuesta.action === 'NONE') return texto;
    if (respuesta.action === 'GUARDRAIL_INTERVENED' && !bloqueado(respuesta)) {
      const anonimo = normalizarTexto((respuesta.outputs ?? []).map((o) => o.text ?? '').join(''));
      if (anonimo) return anonimo;
    }
    throw new ErrorIa(
      'GUARDRAIL_NO_DISPONIBLE',
      'El Guardrail no entregó un texto anonimizado; la nota no se envió al modelo.',
    );
  }

  private conversar(messages: Message[]): Promise<ConverseCommandOutput> {
    return this.cliente.send(
      new ConverseCommand({
        modelId: this.modelo,
        system: [{ text: SISTEMA_EXTRACCION }],
        messages,
        toolConfig: { tools: [{ toolSpec: HERRAMIENTA_BORRADOR }], toolChoice: { auto: {} } },
        inferenceConfig: { maxTokens: 1500 },
      }),
    );
  }

  /** Valida contra el texto anonimizado y lleva las citas al original. */
  private revisar(
    salida: ConverseCommandOutput,
    anonimo: string,
    original: string,
    contexto: ContextoExtraccion,
  ): Intento {
    const respuesta = salida.output?.message;
    if (!respuesta?.content?.length) return { tipo: 'insuficiente' };

    const uso = respuesta.content.find((b) => b.toolUse?.name === NOMBRE_HERRAMIENTA)?.toolUse;
    if (!uso) {
      return {
        tipo: 'invalido',
        problemas: [`no se usó la herramienta ${NOMBRE_HERRAMIENTA}`],
        respuesta,
      };
    }
    const resultado = validar(uso.input, anonimo, contexto);
    if (!resultado.ok) return { tipo: 'invalido', problemas: resultado.problemas, respuesta };
    const { borrador } = resultado;
    if (borrador.evidenciaInsuficiente) return { tipo: 'insuficiente' };

    const problemas: string[] = [];
    const manifestaciones: BorradorEntrante['manifestaciones'] = [];
    for (const { idManifestacion, cita } of borrador.manifestaciones) {
      const enOriginal = mapearCita(cita, anonimo, original);
      if (enOriginal === null)
        problemas.push(`no se pudo ubicar la cita de ${idManifestacion} en el texto`);
      else manifestaciones.push({ idManifestacion, cita: enOriginal });
    }
    if (problemas.length) return { tipo: 'invalido', problemas, respuesta };

    return {
      tipo: 'valido',
      borrador: entregar({
        textoFuente: original,
        nivelSugerido: borrador.nivelSugerido,
        evidenciaInsuficiente: false,
        manifestaciones,
        proveedor: 'bedrock',
        modelo: this.modelo,
      }),
    };
  }
}
