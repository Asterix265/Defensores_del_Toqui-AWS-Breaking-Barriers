import { BorradorEntranteSchema } from '@toqui/shared';
import { z } from 'zod';
import { ApiInterna } from '../api.js';
import { loadEnv } from '../config.js';

const EntradaSchema = z.object({ idCaptura: z.string().min(1), borrador: BorradorEntranteSchema });

/** Entrega el borrador a la API; idempotente por captura. */
export async function handler(evento: unknown) {
  const { idCaptura, borrador } = EntradaSchema.parse(evento);
  return new ApiInterna(loadEnv()).entregarBorrador(idCaptura, borrador);
}
