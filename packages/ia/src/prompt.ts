import type { ContextoExtraccion } from './proveedor.js';

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

export const INSTRUCCION_FOTO = `Describe en español, en 1 a 3 oraciones, lo que hace el niño o niña de la foto, como lo anotaría una educadora de párvulos: acciones observables, materiales y con quién interactúa.
No digas nombres, no describas rasgos físicos ni la apariencia, y no interpretes emociones más allá de lo evidente.
Si no se ve a un niño o niña realizando una actividad, responde exactamente: Sin actividad observable.`;
