import type { BorradorEntrante } from '@toqui/shared';
import { z } from 'zod';
import { loadEnv } from '../config.js';
import { leerObjeto, proveedorIa, textoDeTranscripcion, type EntradaExtraer } from '../pasos.js';

const UbicacionSchema = z.object({ bucket: z.string().min(1), clave: z.string().min(1) });
const EntradaSchema = z.object({
  idCaptura: z.string().min(1),
  contexto: z.object({
    edadMeses: z.number().int(),
    nivelEsperado: z.number().int(),
    catalogo: z.array(z.any()),
  }),
  fuente: z.union([z.object({ texto: z.string() }), z.object({ transcripcion: UbicacionSchema })]),
}) satisfies z.ZodType<EntradaExtraer, unknown>;

/** Extrae el borrador (Guardrail → Claude → validación, con un reintento). */
export async function handler(evento: unknown): Promise<BorradorEntrante> {
  const entrada = EntradaSchema.parse(evento);
  const env = loadEnv();
  const texto =
    'texto' in entrada.fuente
      ? entrada.fuente.texto
      : textoDeTranscripcion(
          new TextDecoder().decode(await leerObjeto(env.AWS_REGION, entrada.fuente.transcripcion)),
        );
  return proveedorIa(env).extraer(texto, entrada.contexto);
}
