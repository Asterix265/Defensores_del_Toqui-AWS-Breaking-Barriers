import type { EjemploDecision } from '@toqui/shared';
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

/**
 * Casos parecidos desde el mensaje de la cola (panel-directora-y-aprendizaje, D4): la API ya
 * eligió las decisiones del mismo jardín y nivel educativo; aquí se ordenan por palabras en común
 * con la nota actual, sin base vectorial. La base de conocimiento sigue vacía.
 */
export class ContextoDesdeMensaje implements FuenteContexto {
  async recuperar(consulta: {
    textoFuente: string;
    ejemplos: EjemploDecision[];
  }): Promise<Contexto> {
    const palabrasNota = palabras(consulta.textoFuente);
    const ordenados = consulta.ejemplos
      .map((e, i) => ({ e, i, comunes: comunes(palabrasNota, palabras(e.textoFuente)) }))
      // Más palabras en común primero; a igualdad, el orden de la API (corregidas y recientes).
      .sort((a, b) => b.comunes - a.comunes || a.i - b.i)
      .map(({ e }) => ({
        textoFuente: e.textoFuente,
        nivel: e.nivel,
        idsManifestaciones: e.idsManifestaciones,
      }));
    return { conocimiento: [], ejemplos: ordenados };
  }
}

/** Palabras de 4 o más letras, sin tildes ni mayúsculas. */
function palabras(texto: string): Set<string> {
  const normal = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return new Set(normal.match(/\p{L}{4,}/gu) ?? []);
}

function comunes(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const p of a) if (b.has(p)) n += 1;
  return n;
}

/** Sin canal de avisos la web se entera por la consulta de respaldo (aviso-propuesta). */
export class AvisadorSoloLog implements Avisador {
  constructor(private readonly log: Log) {}

  async avisar(_idUsuario: string, aviso: { idCaptura: string; estado: string }): Promise<void> {
    this.log('info', 'Aviso no publicado: sin canal configurado', { ...aviso });
  }
}
