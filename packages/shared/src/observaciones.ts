import { z } from 'zod';

/** Grupos de Cognito que habilitan la app. */
export const RolSchema = z.enum(['registrador', 'supervisor']);
export type Rol = z.infer<typeof RolSchema>;

export const TipoCapturaSchema = z.enum(['texto', 'audio', 'foto']);
export type TipoCaptura = z.infer<typeof TipoCapturaSchema>;

/** pendiente → procesando → propuesta → confirmada | corregida → validada; error si el proceso falla. */
export const EstadoObservacionSchema = z.enum([
  'pendiente',
  'procesando',
  'propuesta',
  'confirmada',
  'corregida',
  'validada',
  'error',
]);
export type EstadoObservacion = z.infer<typeof EstadoObservacionSchema>;

/**
 * Texto opcional (`string | null`). Se publica como componente: Swagger interpreta un
 * `type: ['string', 'null']` en línea como arreglo de strings.
 */
export const TextoNuloSchema = z.string().nullable().meta({ id: 'TextoNulo' });

/** Fecha de calendario `AAAA-MM-DD` en la zona horaria de la operación. */
export const FechaSchema = z.iso.date();

/** Respuesta de `GET /me`. */
export const MeResponseSchema = z.object({
  id: z.string(),
  rol: RolSchema,
  nombre: TextoNuloSchema,
  telefono: TextoNuloSchema,
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const CriterioSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  descripcion: TextoNuloSchema,
});
export type Criterio = z.infer<typeof CriterioSchema>;

/** Criterio abreviado dentro de una observación. */
export const CriterioRefSchema = CriterioSchema.pick({ id: true, nombre: true }).meta({
  id: 'CriterioRef',
});

export const CriteriosResponseSchema = z.array(CriterioSchema);

// ---- Subidas ----

/** Tipos de archivo aceptados: los que admiten Transcribe (audio) y Textract (foto). */
export const TIPOS_ARCHIVO = {
  'audio/webm': { captura: 'audio', extension: 'webm' },
  'audio/ogg': { captura: 'audio', extension: 'ogg' },
  'audio/mp4': { captura: 'audio', extension: 'm4a' },
  'audio/mpeg': { captura: 'audio', extension: 'mp3' },
  'audio/wav': { captura: 'audio', extension: 'wav' },
  'image/jpeg': { captura: 'foto', extension: 'jpg' },
  'image/png': { captura: 'foto', extension: 'png' },
} as const satisfies Record<string, { captura: TipoCaptura; extension: string }>;

export const TipoArchivoSchema = z.enum(
  Object.keys(TIPOS_ARCHIVO) as [keyof typeof TIPOS_ARCHIVO, ...(keyof typeof TIPOS_ARCHIVO)[]],
);
export type TipoArchivo = z.infer<typeof TipoArchivoSchema>;

export const TAMANO_MAXIMO_ARCHIVO = 10 * 1024 * 1024;

export const CrearSubidaRequestSchema = z.object({
  /** Tipo MIME sin parámetros (por ejemplo `audio/webm`, no `audio/webm;codecs=opus`). */
  tipo: TipoArchivoSchema,
  /** Tamaño en bytes. */
  tamano: z.number().int().positive().max(TAMANO_MAXIMO_ARCHIVO),
});
export type CrearSubidaRequest = z.infer<typeof CrearSubidaRequestSchema>;

/**
 * URL firmada de S3 para un POST multipart: enviar `campos` como campos del formulario
 * y el archivo al final, en el campo `file`.
 */
export const CrearSubidaResponseSchema = z.object({
  url: z.url(),
  campos: z.record(z.string(), z.string()),
  clave: z.string(),
  expiraEn: z.iso.datetime(),
});
export type CrearSubidaResponse = z.infer<typeof CrearSubidaResponseSchema>;

// ---- Observaciones ----

/** `texto` para `tipo = texto`; `clave` (devuelta por `POST /subidas`) para audio o foto. */
export const CrearObservacionRequestSchema = z
  .object({
    tipo: TipoCapturaSchema,
    texto: z.string().trim().min(1).max(5000).optional(),
    clave: z.string().min(1).optional(),
  })
  .superRefine((datos, ctx) => {
    const campo = datos.tipo === 'texto' ? 'texto' : 'clave';
    const sobrante = datos.tipo === 'texto' ? 'clave' : 'texto';
    if (datos[campo] === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: [campo],
        message: `obligatorio para tipo ${datos.tipo}`,
      });
    }
    if (datos[sobrante] !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: [sobrante],
        message: `no corresponde a tipo ${datos.tipo}`,
      });
    }
  });
export type CrearObservacionRequest = z.infer<typeof CrearObservacionRequestSchema>;

export const CrearObservacionResponseSchema = z.object({
  id: z.uuid(),
  estado: EstadoObservacionSchema,
});
export type CrearObservacionResponse = z.infer<typeof CrearObservacionResponseSchema>;

export const PropuestaSchema = z.object({
  criterio: CriterioRefSchema,
  /** Entre 0 y 1. */
  confianza: z.number().min(0).max(1).nullable(),
  /** Las dos opciones más probables si la confianza es baja; vacío si no hay duda. */
  opciones: z.array(CriterioRefSchema),
  /** URL temporal del audio de Polly que lee la propuesta. */
  audioUrl: z.url().nullable(),
});

// Los esquemas anidados llevan `id` para publicarse como componentes en OpenAPI.
export const UsuarioRefSchema = z
  .object({ id: z.string(), nombre: TextoNuloSchema })
  .meta({ id: 'UsuarioRef' });

export const ObservacionDetalleSchema = z.object({
  id: z.uuid(),
  tipo: TipoCapturaSchema,
  estado: EstadoObservacionSchema,
  fecha: FechaSchema,
  creadoEn: z.iso.datetime(),
  usuario: UsuarioRefSchema,
  /** Texto escrito por la persona. */
  texto: TextoNuloSchema,
  /** Texto obtenido del audio o la foto. */
  textoExtraido: TextoNuloSchema,
  tieneArchivo: z.boolean(),
  /** Presente cuando la IA ya propuso un criterio. */
  propuesta: PropuestaSchema.nullable(),
  /** Criterio vigente: la propuesta o la última revisión o validación. */
  criterio: CriterioRefSchema.nullable(),
  validadoEn: z.iso.datetime().nullable(),
});
export type ObservacionDetalle = z.infer<typeof ObservacionDetalleSchema>;

export const ObservacionResumenSchema = z
  .object({
    id: z.uuid(),
    tipo: TipoCapturaSchema,
    estado: EstadoObservacionSchema,
    fecha: FechaSchema,
    creadoEn: z.iso.datetime(),
    usuario: UsuarioRefSchema,
    /** Primeros caracteres del texto escrito o extraído. */
    extracto: TextoNuloSchema,
    criterio: CriterioRefSchema.nullable(),
  })
  .meta({ id: 'ObservacionResumen' });
export type ObservacionResumen = z.infer<typeof ObservacionResumenSchema>;

/** Cuerpo de `/revision` (registrador) y `/validacion` (supervisor). */
export const DecisionRequestSchema = z.object({ criterioId: z.string().min(1) });
export type DecisionRequest = z.infer<typeof DecisionRequestSchema>;

export const ArchivoResponseSchema = z.object({
  url: z.url(),
  tipo: z.string(),
  expiraEn: z.iso.datetime(),
});
export type ArchivoResponse = z.infer<typeof ArchivoResponseSchema>;

export const MiDiaQuerySchema = z.object({ fecha: FechaSchema.optional() });

export const MiDiaResponseSchema = z.object({
  fecha: FechaSchema,
  observaciones: z.array(ObservacionResumenSchema),
});
export type MiDiaResponse = z.infer<typeof MiDiaResponseSchema>;

// ---- Panel de supervisión ----

export const PanelObservacionesQuerySchema = z.object({
  fecha: FechaSchema.optional(),
  usuarioId: z.string().min(1).optional(),
  criterioId: z.string().min(1).optional(),
  estado: EstadoObservacionSchema.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
});
export type PanelObservacionesQuery = z.infer<typeof PanelObservacionesQuerySchema>;

export const PanelObservacionesResponseSchema = z.object({
  items: z.array(ObservacionResumenSchema),
  total: z.number().int(),
  pagina: z.number().int(),
  tamano: z.number().int(),
});
export type PanelObservacionesResponse = z.infer<typeof PanelObservacionesResponseSchema>;

export const PanelResumenQuerySchema = z.object({ fecha: FechaSchema.optional() });

export const PanelResumenResponseSchema = z.object({
  fecha: FechaSchema,
  total: z.number().int(),
  /** `criterio` es null para observaciones aún sin propuesta. */
  porCriterio: z.array(
    z.object({ criterio: CriterioRefSchema.nullable(), total: z.number().int() }),
  ),
  porEstado: z.array(z.object({ estado: EstadoObservacionSchema, total: z.number().int() })),
  porPersona: z.array(z.object({ usuario: UsuarioRefSchema, total: z.number().int() })),
});
export type PanelResumenResponse = z.infer<typeof PanelResumenResponseSchema>;
