import type { BorradorEntrante, EstadoCaptura, MensajeCaptura } from '@toqui/shared';
import { normalizar } from './normalizacion.js';
import type { Contexto, Dependencias } from './puertos.js';
import { describirError, type Log } from './registro-log.js';
import { borradorSinEvidencia, validarClasificacion } from './validacion.js';

const CONTEXTO_VACIO: Contexto = { conocimiento: [], ejemplos: [] };

/** Intentos del modelo por trabajo: el segundo recibe los problemas del primero (D6). */
const INTENTOS_CLASIFICACION = 2;

export interface ResultadoProceso {
  estado: EstadoCaptura;
  borrador: BorradorEntrante;
}

/**
 * Pasos de D4, en orden: normalizar → anonimizar → recuperar contexto → clasificar →
 * validar → entregar. El aviso lo publica el handler, tanto si sale bien como si falla.
 *
 * Lanza `ErrorPermanente` si la captura no se puede procesar, `ErrorCapturaCerrada` si la API
 * ya no la acepta y cualquier otro error si conviene reintentar.
 */
export async function procesarCaptura(
  mensaje: MensajeCaptura,
  deps: Dependencias,
  log: Log,
): Promise<ResultadoProceso> {
  const base = { idCaptura: mensaje.idCaptura, formato: mensaje.formato };
  const medir = cronometro();

  const normalizado = await normalizar(mensaje, deps);
  log('info', 'Captura normalizada', { ...base, via: normalizado.via, ms: medir() });

  // Antes de cualquier otro uso: el texto anonimizado es el textoFuente del borrador (D5).
  const textoFuente = await deps.anonimizador.anonimizar(normalizado.texto);
  log('info', 'Texto anonimizado', { ...base, ms: medir() });

  const contexto = await deps.contexto
    .recuperar({ textoFuente, idJardin: mensaje.idJardin })
    .catch((error: unknown) => {
      // Sin memoria ni base de conocimiento se clasifica igual con el catálogo del mensaje.
      log('warn', 'Contexto no disponible', { ...base, ...describirError(error) });
      return CONTEXTO_VACIO;
    });
  log('info', 'Contexto recuperado', {
    ...base,
    fragmentos: contexto.conocimiento.length,
    ejemplos: contexto.ejemplos.length,
    ms: medir(),
  });

  const borrador = await clasificar(mensaje, textoFuente, contexto, deps, log);
  log('info', 'Borrador listo', {
    ...base,
    proveedor: borrador.proveedor,
    evidenciaInsuficiente: borrador.evidenciaInsuficiente,
    manifestaciones: borrador.manifestaciones.length,
    ms: medir(),
  });

  const estado = await deps.api.entregarBorrador(mensaje.idCaptura, borrador);
  log('info', 'Borrador entregado', { ...base, estado, ms: medir() });
  return { estado, borrador };
}

async function clasificar(
  mensaje: MensajeCaptura,
  textoFuente: string,
  contexto: Contexto,
  deps: Dependencias,
  log: Log,
): Promise<BorradorEntrante> {
  const { clasificador } = deps;
  let correccion: string[] | undefined;
  for (let intento = 1; intento <= INTENTOS_CLASIFICACION; intento++) {
    // Los errores del proveedor (cuota, red) se propagan: los reintenta la cola.
    const salida = await clasificador.clasificar({
      textoFuente,
      edadMeses: mensaje.edadMeses,
      nivelEsperado: mensaje.nivelEsperado,
      catalogo: mensaje.catalogo,
      contexto,
      ...(correccion ? { correccion } : {}),
    });
    const validacion = validarClasificacion(salida, textoFuente, mensaje.catalogo);
    if (validacion.ok) {
      return {
        textoFuente,
        ...validacion.respuesta,
        proveedor: clasificador.proveedor,
        ...(clasificador.modelo ? { modelo: clasificador.modelo } : {}),
      };
    }
    correccion = validacion.problemas;
    log('warn', 'Clasificación inválida', {
      idCaptura: mensaje.idCaptura,
      intento,
      problemas: validacion.problemas,
    });
  }
  return borradorSinEvidencia(textoFuente, clasificador.proveedor, clasificador.modelo);
}

function cronometro(): () => number {
  let anterior = performance.now();
  return () => {
    const ahora = performance.now();
    const transcurrido = Math.round(ahora - anterior);
    anterior = ahora;
    return transcurrido;
  };
}
