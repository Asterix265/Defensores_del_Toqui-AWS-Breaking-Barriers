import { z } from 'zod';
import { ApiInterna } from '../api.js';
import { loadEnv } from '../config.js';
import type { Preparado } from '../pasos.js';

const EntradaSchema = z.object({ idCaptura: z.string().min(1) });

/** Estados en los que el pipeline todavía debe producir un borrador. */
const PENDIENTES = new Set(['procesando', 'error']);

/** Primer paso: pide a la API el formato, el texto escrito, la edad y el catálogo. */
export async function handler(evento: unknown): Promise<Preparado> {
  const { idCaptura } = EntradaSchema.parse(evento);
  const c = await new ApiInterna(loadEnv()).contexto(idCaptura);
  return {
    omitir: !PENDIENTES.has(c.estado),
    formato: c.formato,
    texto: c.texto,
    contexto: { edadMeses: c.edadMeses, nivelEsperado: c.nivelEsperado, catalogo: c.catalogo },
  };
}
