import type {
  AvisoCaptura,
  BorradorEntrante,
  EstadoCaptura,
  Manifestacion,
  TipoArchivo,
} from '@toqui/shared';

/**
 * Puertos del pipeline. El orquestador solo conoce estas interfaces; cada una tiene un
 * adaptador AWS y, cuando aplica, uno simulado para pruebas y para la demo sin IA.
 */

/** Audio → texto (Amazon Transcribe). */
export interface Transcriptor {
  transcribir(entrada: { idCaptura: string; clave: string; tipo: TipoArchivo }): Promise<string>;
}

/**
 * Foto de una nota → texto. Recibe la clave en el bucket de capturas: Textract lo lee directo
 * de S3, y un lector con IA descargaría la imagen en su adaptador.
 */
export interface LectorImagen {
  readonly proveedor: string;
  leer(entrada: { idCaptura: string; clave: string; tipo: TipoArchivo }): Promise<string>;
}

/** Reemplaza nombres, RUT y otros datos personales antes de cualquier otro uso del texto. */
export interface Anonimizador {
  anonimizar(texto: string): Promise<string>;
}

/** Decisión previa de una educadora del mismo jardín (memoria, D7). */
export interface EjemploMemoria {
  textoFuente: string;
  nivel: number;
  idsManifestaciones: string[];
}

export interface Contexto {
  /** Fragmentos de la base de conocimiento del catálogo (D8). */
  conocimiento: string[];
  /** Hasta 5 casos parecidos del mismo jardín. */
  ejemplos: EjemploMemoria[];
}

export interface FuenteContexto {
  recuperar(consulta: { textoFuente: string; idJardin: string }): Promise<Contexto>;
}

export interface EntradaClasificacion {
  /** Texto ya anonimizado: las citas deben salir literalmente de aquí. */
  textoFuente: string;
  edadMeses: number;
  nivelEsperado: number;
  /** Únicas manifestaciones que se pueden proponer. */
  catalogo: Manifestacion[];
  contexto: Contexto;
  /** Problemas del intento anterior, para que el modelo los corrija (D6). */
  correccion?: string[];
}

/**
 * Clasificación con IA. Devuelve la salida cruda del modelo (`unknown`): el orquestador la
 * valida con `RespuestaClasificacionSchema` y contra el catálogo, así que el proveedor no
 * necesita confiar en sí mismo.
 */
export interface Clasificador {
  readonly proveedor: string;
  readonly modelo?: string;
  clasificar(entrada: EntradaClasificacion): Promise<unknown>;
}

/** Endpoint interno de la API (`PIPELINE_TOKEN`). Devuelve el estado resultante. */
export interface ApiInterna {
  entregarBorrador(idCaptura: string, borrador: BorradorEntrante): Promise<EstadoCaptura>;
  informarError(idCaptura: string, detalle: string): Promise<EstadoCaptura>;
}

/** Aviso a la web de quien registró la captura (AppSync Events, D9). */
export interface Avisador {
  avisar(idUsuario: string, aviso: AvisoCaptura): Promise<void>;
}

export interface Dependencias {
  transcriptor: Transcriptor;
  lectorImagen: LectorImagen;
  anonimizador: Anonimizador;
  contexto: FuenteContexto;
  clasificador: Clasificador;
  api: ApiInterna;
  avisador: Avisador;
}
