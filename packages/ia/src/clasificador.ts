import { ConverseCommand, type BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import {
  HERRAMIENTA_BORRADOR,
  mensajeClasificacion,
  NOMBRE_HERRAMIENTA,
  sistemaClasificacion,
} from './prompt.js';
import type { ManifestacionCatalogo } from './proveedor.js';
import { ubicarCita } from './validacion.js';

export interface EjemploCaso {
  textoFuente: string;
  nivel: number;
  idsManifestaciones: string[];
}

/** Entrada de la clasificación. Nombres alineados con el puerto `Clasificador` de apps/pipeline. */
export interface EntradaClaude {
  /** Texto YA anonimizado: las citas deben salir literalmente de aquí. */
  textoFuente: string;
  edadMeses: number;
  nivelEsperado: number;
  catalogo: ManifestacionCatalogo[];
  /** Fragmentos de la base de conocimiento (máximo 5; opcional). */
  conocimiento?: string[];
  /** Casos parecidos del mismo jardín (máximo 5; opcional). */
  ejemplos?: EjemploCaso[];
  /** Problemas del intento anterior, para que el modelo los corrija (opcional). */
  correccion?: string[];
}

export interface OpcionesClaude {
  /** Tiempo máximo de la llamada a Converse. Por defecto 60 000 ms. */
  tiempoMaximoMs?: number;
}

const TIEMPO_MAXIMO_MS = 60_000;

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Lleva la salida de la herramienta a la forma de `validarClasificacion` del pipeline, sin
 * validarla ni inventar campos: `nivel` → `nivelSugerido`, evidencia insuficiente sin restos y
 * cada cita como el fragmento literal del texto (o la original si no se encuentra).
 */
function normalizar(input: Objeto, textoFuente: string): Objeto {
  const salida: Objeto = { ...input };
  if ('nivel' in salida) {
    if (!('nivelSugerido' in salida)) salida.nivelSugerido = salida.nivel;
    delete salida.nivel;
  }
  if (salida.evidenciaInsuficiente === true) {
    salida.nivelSugerido = null;
    salida.manifestaciones = [];
  }
  if (Array.isArray(salida.manifestaciones)) {
    salida.manifestaciones = salida.manifestaciones.map((m: unknown) =>
      esObjeto(m) && typeof m.cita === 'string'
        ? { ...m, cita: ubicarCita(m.cita, textoFuente) ?? m.cita }
        : m,
    );
  }
  return salida;
}

/**
 * Una sola llamada a Converse con la herramienta `registrar_borrador`. Devuelve la salida cruda
 * con la forma de `validarClasificacion`; NO la valida ni reintenta (eso lo hace el orquestador
 * del pipeline). Sin bloque de la herramienta, o con un `input` que no es objeto, devuelve `{}`.
 * Los errores del SDK (incluida la cancelación por tiempo) se propagan sin envolver.
 */
export async function clasificarConClaude(
  cliente: Pick<BedrockRuntimeClient, 'send'>,
  modelo: string,
  entrada: EntradaClaude,
  opciones?: OpcionesClaude,
): Promise<unknown> {
  const respuesta = await cliente.send(
    new ConverseCommand({
      modelId: modelo,
      system: [{ text: sistemaClasificacion(entrada) }],
      messages: [{ role: 'user', content: [{ text: mensajeClasificacion(entrada) }] }],
      toolConfig: { tools: [{ toolSpec: HERRAMIENTA_BORRADOR }], toolChoice: { auto: {} } },
      inferenceConfig: { maxTokens: 1500 },
    }),
    { abortSignal: AbortSignal.timeout(opciones?.tiempoMaximoMs ?? TIEMPO_MAXIMO_MS) },
  );
  const uso = respuesta.output?.message?.content?.find(
    (b) => b.toolUse?.name === NOMBRE_HERRAMIENTA,
  )?.toolUse;
  const input: unknown = uso?.input;
  return esObjeto(input) ? normalizar(input, entrada.textoFuente) : {};
}
