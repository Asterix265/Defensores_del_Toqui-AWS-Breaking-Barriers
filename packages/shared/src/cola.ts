import { z } from 'zod';
import {
  ManifestacionSchema,
  NivelEducativoSchema,
  NivelSchema,
  TIPOS_ARCHIVO,
  type TipoArchivo,
} from './registro.js';

// ---- Cola de procesamiento (cambio cola-ia-y-amplify, D3) ----

const tiposDe = (formato: 'audio' | 'foto') =>
  (Object.keys(TIPOS_ARCHIVO) as TipoArchivo[]).filter((t) => TIPOS_ARCHIVO[t].formato === formato);

const TipoAudioSchema = z.enum(tiposDe('audio') as [TipoArchivo, ...TipoArchivo[]]);
const TipoFotoSchema = z.enum(tiposDe('foto') as [TipoArchivo, ...TipoArchivo[]]);

/** Tope de decisiones previas por mensaje y largo de su texto. */
export const MAXIMO_EJEMPLOS = 5;
export const LARGO_EJEMPLO = 400;

/**
 * Decisión previa de una educadora: solo el texto ya anonimizado (`textoFuente` del borrador),
 * el nivel y las manifestaciones que confirmó. Nunca IDs de niño o niña, captura ni usuario.
 */
export const EjemploDecisionSchema = z.object({
  textoFuente: z.string().min(1).max(LARGO_EJEMPLO),
  nivel: NivelSchema,
  idsManifestaciones: z.array(z.string().min(1)).min(1).max(5),
  /** true si la educadora cambió la propuesta de la IA. */
  corregida: z.boolean(),
});
export type EjemploDecision = z.infer<typeof EjemploDecisionSchema>;

const MensajeBaseSchema = z.object({
  version: z.literal(1),
  idCaptura: z.uuid(),
  /** `sub` de Cognito de quien registró: solo se usa para el canal de avisos. */
  idUsuario: z.string().min(1),
  idJardin: z.string().min(1),
  edadMeses: z.number().int().min(0),
  /** Nivel educativo del niño o niña: define el catálogo de la rúbrica que corresponde. */
  nivelEducativo: NivelEducativoSchema,
  /**
   * Nivel de referencia, no esperado para la edad: mediana de los últimos niveles validados del
   * niño o niña (1 si no tiene). Es contexto para la IA, no un límite.
   */
  nivelEsperado: NivelSchema,
  /** Manifestaciones permitidas: las del nivel educativo. La IA solo puede proponer estas. */
  catalogo: z.array(ManifestacionSchema).min(1),
  /**
   * Decisiones previas de educadoras del mismo jardín y nivel educativo (aprender de las
   * correcciones, panel-directora-y-aprendizaje D4). Opcional: los mensajes antiguos no lo traen.
   */
  ejemplos: z.array(EjemploDecisionSchema).max(MAXIMO_EJEMPLOS).optional(),
});

/**
 * Trabajo de la cola: autosuficiente, para que la Lambda no consulte la base.
 * No lleva `id_nino`, nombres ni RUT.
 */
export const MensajeCapturaSchema = z.discriminatedUnion('formato', [
  MensajeBaseSchema.extend({
    formato: z.literal('texto'),
    texto: z.string().trim().min(1).max(5000),
  }),
  MensajeBaseSchema.extend({
    formato: z.literal('audio'),
    /** Clave en el bucket de capturas: `capturas/<id>.<ext>`. */
    archivoClave: z.string().min(1),
    archivoTipo: TipoAudioSchema,
    /** Tamaño comprobado en S3 al avisar la subida; se declara en `procesamiento`. */
    archivoBytes: z.number().int().nonnegative().optional(),
  }),
  MensajeBaseSchema.extend({
    formato: z.literal('foto'),
    archivoClave: z.string().min(1),
    archivoTipo: TipoFotoSchema,
    archivoBytes: z.number().int().nonnegative().optional(),
  }),
]);
export type MensajeCaptura = z.infer<typeof MensajeCapturaSchema>;

/** Aviso a la web: solo el id y el estado; la web pide el detalle a la API (aviso-propuesta). */
export const AvisoCapturaSchema = z.object({
  idCaptura: z.uuid(),
  estado: z.enum(['borrador_listo', 'error']),
});
export type AvisoCaptura = z.infer<typeof AvisoCapturaSchema>;
