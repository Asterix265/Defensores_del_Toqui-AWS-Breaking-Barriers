import { SIN_TEXTO, type ContextoExtraccion } from './proveedor.js';

export const NOMBRE_HERRAMIENTA = 'registrar_borrador';

export const SISTEMA_EXTRACCION = `Ayudas a educadoras de párvulos a sistematizar sus observaciones de aprendizaje.
Recibes una nota breve, escrita o transcrita, y un catálogo de manifestaciones observables de una ruta de aprendizaje sintética.

Tu tarea es proponer hasta 5 manifestaciones del catálogo que la nota respalde explícitamente, todas de un mismo nivel.

Reglas:
- Usa solo IDs del catálogo entregado y un nivel que aparezca en él.
- Cada manifestación lleva una cita copiada exactamente de la nota: un fragmento continuo, sin cambiar palabras, tildes ni puntuación.
- No infieras más allá de lo escrito. Si la nota no describe una conducta observable que calce con el catálogo, marca evidenciaInsuficiente en true y no propongas manifestaciones.
- Prefiere el nivel esperado para la edad salvo que la nota describa con claridad conductas de otro nivel del catálogo.
- El nivel es una estimación pedagógica para que la educadora la revise, no un diagnóstico.
- Los textos entre llaves, como {NAME}, son datos anonimizados: trátalos como un nombre cualquiera.
- Responde siempre llamando a la herramienta ${NOMBRE_HERRAMIENTA}.`;

/** Esquema JSON de la herramienta: fuerza una salida estructurada (D7). */
export const ESQUEMA_HERRAMIENTA = {
  type: 'object',
  properties: {
    evidenciaInsuficiente: {
      type: 'boolean',
      description: 'true si la nota no respalda ninguna manifestación del catálogo',
    },
    nivel: {
      type: ['integer', 'null'],
      description: 'Nivel de la ruta de todas las manifestaciones propuestas; null si no hay',
    },
    manifestaciones: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          idManifestacion: { type: 'string', description: 'ID del catálogo, p. ej. MAN-L07-MF-01' },
          cita: { type: 'string', description: 'Fragmento copiado literalmente de la nota' },
        },
        required: ['idManifestacion', 'cita'],
      },
    },
  },
  required: ['evidenciaInsuficiente', 'nivel', 'manifestaciones'],
} as const;

/** Mensaje de la educadora: edad, nivel esperado, catálogo agrupado por nivel y la nota. */
export function mensajeExtraccion(texto: string, contexto: ContextoExtraccion): string {
  const porNivel = new Map<number, string[]>();
  for (const m of [...contexto.catalogo].sort((a, b) => a.id.localeCompare(b.id))) {
    const lineas = porNivel.get(m.nivel) ?? [];
    lineas.push(`- ${m.id} (${m.dominio}): ${m.textoObservable}`);
    porNivel.set(m.nivel, lineas);
  }
  const catalogo = [...porNivel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([nivel, lineas]) => `Nivel ${nivel}:\n${lineas.join('\n')}`)
    .join('\n\n');
  return [
    `Edad: ${contexto.edadMeses} meses. Nivel esperado para la edad: ${contexto.nivelEsperado}.`,
    `Catálogo:\n${catalogo}`,
    `Nota:\n<<<\n${texto}\n>>>`,
  ].join('\n\n');
}

/**
 * Lectura de la foto: el uso principal es el post-it o la hoja donde la educadora anotó la
 * observación; si no hay nada escrito, se describe la actividad que se ve.
 */
export const INSTRUCCION_FOTO = `La foto la tomó una educadora de párvulos para registrar una observación. Suele ser un post-it o una hoja con una nota escrita a mano; a veces es una escena de la sala.
- Si hay texto escrito, transcríbelo literalmente: mismas palabras, sin corregir, completar ni comentar. Si una palabra no se lee, escribe [ilegible].
- Si no hay texto pero se ve a un niño o niña haciendo algo, describe en 1 a 3 oraciones las acciones observables, los materiales y con quién interactúa. No digas nombres, no describas rasgos físicos ni interpretes emociones más allá de lo evidente.
- Si no hay texto ni actividad, responde exactamente: ${SIN_TEXTO}
Responde solo con la transcripción o la descripción, sin introducciones.`;
