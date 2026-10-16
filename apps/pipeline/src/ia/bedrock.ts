import type { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { clasificarConClaude } from '@toqui/ia';
import type { Clasificador, EntradaClasificacion } from '../puertos.js';

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
    return clasificarConClaude(this.cliente, this.modelo, {
      textoFuente: entrada.textoFuente,
      edadMeses: entrada.edadMeses,
      nivelEsperado: entrada.nivelEsperado,
      catalogo: entrada.catalogo,
      conocimiento: entrada.contexto.conocimiento,
      ejemplos: entrada.contexto.ejemplos,
      correccion: entrada.correccion,
    });
  }
}
