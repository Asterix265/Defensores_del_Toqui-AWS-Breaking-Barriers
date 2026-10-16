import { z } from 'zod';
import {
  MAXIMO_MANIFESTACIONES,
  sinEvidencia,
  type ContextoExtraccion,
  type ResultadoValidacion,
} from './proveedor.js';

/** Lo que propone el modelo (o el fake) antes de validarlo contra el catálogo y el texto. */
export const PropuestaSchema = z.object({
  evidenciaInsuficiente: z.boolean(),
  nivel: z.number().int().nullable().optional(),
  manifestaciones: z
    .array(z.object({ idManifestacion: z.string().min(1), cita: z.string().min(1) }))
    .optional(),
});
export type Propuesta = z.infer<typeof PropuestaSchema>;

/** Mensajes de zod en español sin cambiar la configuración global de quien use el módulo. */
const { localeError } = z.locales.es();

/** Comillas, puntuación y espacios que el modelo suele agregar o quitar en los extremos. */
const EXTREMOS = /^[\s"'«»“”‘’.,;:!?¡¿()]+|[\s"'«»“”‘’.,;:!?¡¿()]+$/gu;

export function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Literal escapado que acepta cualquier cantidad de espacios donde el original tiene alguno. */
export function patronFlexible(literal: string): string {
  return escaparRegex(literal).replace(/\s+/g, '\\s+');
}

/**
 * Ubica la cita en el texto tolerando mayúsculas, espacios repetidos y comillas o puntuación
 * en los extremos. Devuelve el fragmento tal cual está en el texto, o `null`.
 */
export function ubicarCita(cita: string, texto: string): string | null {
  if (cita && texto.includes(cita)) return cita;
  const limpia = cita.replace(EXTREMOS, '');
  if (!limpia) return null;
  return new RegExp(patronFlexible(limpia), 'iu').exec(texto)?.[0] ?? null;
}

/**
 * Valida una propuesta contra el texto y el catálogo recibido: niveles y núcleos salen del
 * catálogo, nunca de constantes del módulo.
 */
export function validar(
  propuesta: unknown,
  texto: string,
  contexto: ContextoExtraccion,
  opciones?: { maxManifestaciones?: number },
): ResultadoValidacion {
  const formato = PropuestaSchema.safeParse(propuesta, { error: localeError });
  if (!formato.success) {
    return {
      ok: false,
      problemas: formato.error.issues.map(
        (issue) => `formato inválido en «${issue.path.join('.') || 'propuesta'}»: ${issue.message}`,
      ),
    };
  }
  const { evidenciaInsuficiente, nivel, manifestaciones = [] } = formato.data;
  if (evidenciaInsuficiente) return { ok: true, borrador: sinEvidencia(texto) };

  const problemas: string[] = [];
  const niveles = new Set(contexto.catalogo.map((m) => m.nivel));
  const porId = new Map(contexto.catalogo.map((m) => [m.id, m]));
  const maximo = Math.min(
    opciones?.maxManifestaciones ?? MAXIMO_MANIFESTACIONES,
    MAXIMO_MANIFESTACIONES,
  );

  if (nivel === null || nivel === undefined) {
    problemas.push('falta el nivel propuesto');
  } else if (!niveles.has(nivel)) {
    const disponibles = [...niveles].sort((a, b) => a - b).join(', ');
    problemas.push(`el nivel ${nivel} no está entre los del catálogo (${disponibles})`);
  }
  if (manifestaciones.length === 0) {
    problemas.push('se debe proponer al menos 1 manifestación');
  } else if (manifestaciones.length > maximo) {
    problemas.push(`se proponen ${manifestaciones.length} manifestaciones; el máximo es ${maximo}`);
  }

  const vistas = new Set<string>();
  const citadas: { idManifestacion: string; cita: string }[] = [];
  for (const { idManifestacion, cita } of manifestaciones) {
    if (vistas.has(idManifestacion)) problemas.push(`${idManifestacion} está repetida`);
    vistas.add(idManifestacion);
    const enCatalogo = porId.get(idManifestacion);
    if (!enCatalogo) {
      problemas.push(`${idManifestacion} no está en el catálogo`);
    } else if (nivel !== null && nivel !== undefined && enCatalogo.nivel !== nivel) {
      problemas.push(
        `${idManifestacion} es del nivel ${enCatalogo.nivel}; todas deben ser del nivel ${nivel}`,
      );
    }
    const fragmento = ubicarCita(cita, texto);
    if (fragmento === null) problemas.push(`la cita de ${idManifestacion} no está en el texto`);
    else citadas.push({ idManifestacion, cita: fragmento });
  }

  if (problemas.length > 0 || nivel === null || nivel === undefined) {
    return { ok: false, problemas };
  }
  return {
    ok: true,
    borrador: {
      textoFuente: texto,
      nivelSugerido: nivel,
      evidenciaInsuficiente: false,
      manifestaciones: citadas,
    },
  };
}
