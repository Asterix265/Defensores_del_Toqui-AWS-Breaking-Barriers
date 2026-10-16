import type { Avisador, Contexto, FuenteContexto } from '../puertos.js';
import type { Log } from '../registro-log.js';

/**
 * Reemplazos mientras no existan la memoria (S3 Vectors), la base de conocimiento y AppSync
 * Events en la infraestructura. El orquestador funciona igual sin ellos.
 */

export class ContextoVacio implements FuenteContexto {
  async recuperar(): Promise<Contexto> {
    return { conocimiento: [], ejemplos: [] };
  }
}

/** Sin canal de avisos la web se entera por la consulta de respaldo (aviso-propuesta). */
export class AvisadorSoloLog implements Avisador {
  constructor(private readonly log: Log) {}

  async avisar(_idUsuario: string, aviso: { idCaptura: string; estado: string }): Promise<void> {
    this.log('info', 'Aviso no publicado: sin canal configurado', { ...aviso });
  }
}
