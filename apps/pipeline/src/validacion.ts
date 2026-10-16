import { z } from 'zod';
import { NivelSchema, type BorradorEntrante, type Manifestacion } from '@toqui/shared';

/** Lo que debe devolver cualquier clasificador; `textoFuente` y `proveedor` los pone el pipeline. */
export const RespuestaClasificacionSchema = z.object({
  nivelSugerido: NivelSchema.nullable(),
  evidenciaInsuficiente: z.boolean(),
  manifestaciones: z
    .array(z.object({ idManifestacion: z.string().min(1), cita: z.string().min(1) }))
    .max(5),
});
export type RespuestaClasificacion = z.infer<typeof RespuestaClasificacionSchema>;

export type ResultadoValidacion =
  { ok: true; respuesta: RespuestaClasificacion } | { ok: false; problemas: string[] };

/**
 * Mismas reglas que `validarBorrador` de la API, más que cada id esté en el catálogo
 * permitido del mensaje (D6). Así un borrador que sale de aquí no debería volver con 422.
 */
export function validarClasificacion(
  salida: unknown,
  textoFuente: string,
  catalogo: Manifestacion[],
): ResultadoValidacion {
  const parseo = RespuestaClasificacionSchema.safeParse(salida);
  if (!parseo.success) {
    return {
      ok: false,
      problemas: parseo.error.issues.map((i) => `${i.path.join('.') || 'respuesta'}: ${i.message}`),
    };
  }
  const r = parseo.data;
  const problemas: string[] = [];
  const permitidas = new Map(catalogo.map((m) => [m.id, m]));

  if (r.evidenciaInsuficiente) {
    if (r.manifestaciones.length > 0)
      problemas.push('con evidencia insuficiente no se proponen manifestaciones');
    if (r.nivelSugerido !== null) problemas.push('con evidencia insuficiente el nivel es null');
  } else {
    if (r.nivelSugerido === null) problemas.push('falta el nivel sugerido');
    if (r.manifestaciones.length === 0) problemas.push('faltan manifestaciones');
  }
  const vistas = new Set<string>();
  for (const m of r.manifestaciones) {
    if (vistas.has(m.idManifestacion)) problemas.push(`${m.idManifestacion} está repetida`);
    vistas.add(m.idManifestacion);
    const encontrada = permitidas.get(m.idManifestacion);
    if (!encontrada) problemas.push(`${m.idManifestacion} no está en el catálogo permitido`);
    else if (encontrada.nivel !== r.nivelSugerido)
      problemas.push(`${m.idManifestacion} no es del nivel sugerido`);
    if (!textoFuente.includes(m.cita))
      problemas.push(`la cita de ${m.idManifestacion} no aparece literalmente en el texto`);
  }
  return problemas.length ? { ok: false, problemas } : { ok: true, respuesta: r };
}

/** Borrador de respaldo cuando el modelo no logra una respuesta válida. */
export function borradorSinEvidencia(
  textoFuente: string,
  proveedor: string,
  modelo?: string,
): BorradorEntrante {
  return {
    textoFuente,
    nivelSugerido: null,
    evidenciaInsuficiente: true,
    manifestaciones: [],
    proveedor,
    ...(modelo ? { modelo } : {}),
  };
}
