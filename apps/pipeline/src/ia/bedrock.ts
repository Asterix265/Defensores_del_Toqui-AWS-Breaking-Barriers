import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { clasificarConClaude } from '@toqui/ia';
import type { Clasificador, EntradaClasificacion } from '../puertos.js';

/**
 * Tope de cada llamada a Claude. Audio: hasta 90 s de Transcribe más dos llamadas de 40 s caben
 * en los 180 s de la Lambda. En la prueba en vivo cada llamada tardó menos de 5 s.
 */
export const TIEMPO_MAXIMO_CLAUDE_MS = 40_000;

/**
 * Proveedor `bedrock`: clasifica con Claude (Converse con la herramienta `registrar_borrador`
 * de `@toqui/ia`). Devuelve la salida cruda: la validación y el reintento con corrección los
 * hace el orquestador. No captura errores: los del SDK suben tal cual y la cola los reintenta.
 */
export class ClasificadorBedrock implements Clasificador {
  readonly proveedor = 'bedrock';

  constructor(
    private readonly cliente: Pick<BedrockRuntimeClient, 'send'>,
    readonly modelo: string,
  ) {}

  clasificar(entrada: EntradaClasificacion): Promise<unknown> {
    return clasificarConClaude(
      this.cliente,
      this.modelo,
      {
        textoFuente: entrada.textoFuente,
        edadMeses: entrada.edadMeses,
        nivelEsperado: entrada.nivelEsperado,
        catalogo: entrada.catalogo,
        conocimiento: entrada.contexto.conocimiento,
        ejemplos: entrada.contexto.ejemplos,
        correccion: entrada.correccion,
      },
      { tiempoMaximoMs: TIEMPO_MAXIMO_CLAUDE_MS },
    );
  }
}
