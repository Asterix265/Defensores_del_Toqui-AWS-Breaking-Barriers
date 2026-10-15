import { normalizarFake, TAMANO_MAXIMO_IMAGEN, type FormatoImagen } from '@toqui/ia';
import { z } from 'zod';
import { loadEnv } from '../config.js';
import { leerObjeto, proveedorIa, type Fuente } from '../pasos.js';

const EntradaSchema = z.object({
  idCaptura: z.string().min(1),
  bucket: z.string().min(1),
  clave: z.string().min(1),
});

const FORMATOS: Record<string, FormatoImagen> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png' };

/** La foto no se puede leer (formato o tamaño): reintentar no ayuda. */
export class FotoNoValida extends Error {
  override name = 'FotoNoValida';
}

/** Normaliza una foto a texto con Claude multimodal (D6). */
export async function handler(evento: unknown): Promise<Fuente> {
  const entrada = EntradaSchema.parse(evento);
  const env = loadEnv();
  const ia = proveedorIa(env);
  if (!ia.describirFoto) return { texto: normalizarFake('foto', entrada.idCaptura, null) };

  const formato = FORMATOS[entrada.clave.split('.').pop()?.toLowerCase() ?? ''];
  if (!formato) throw new FotoNoValida('Solo se pueden leer fotos JPG o PNG');
  const imagen = await leerObjeto(env.AWS_REGION, entrada);
  if (imagen.byteLength > TAMANO_MAXIMO_IMAGEN) {
    const mb = (imagen.byteLength / 1024 / 1024).toFixed(1).replace('.', ',');
    throw new FotoNoValida(`La foto pesa ${mb} MB; el máximo para leerla es 3,75 MB`);
  }
  return { texto: await ia.describirFoto(imagen, formato) };
}
