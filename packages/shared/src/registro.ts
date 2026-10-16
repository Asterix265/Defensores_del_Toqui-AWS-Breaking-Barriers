import { z } from 'zod';

/**
 * Texto opcional (`string | null`). Se publica como componente: Swagger interpreta un
 * `type: ['string', 'null']` en línea como arreglo de strings.
 *
 * Los esquemas con `.meta({ id })` se publican como componentes y no pueden ser además el
 * esquema raíz de un DTO (nestjs-zod los duplicaría).
 */
export const TextoNuloSchema = z.string().nullable().meta({ id: 'TextoNulo' });

/** Fecha de calendario `AAAA-MM-DD` en la zona horaria de la operación. */
export const FechaSchema = z.iso.date();

/** Grupos de Cognito. */
export const GrupoSchema = z.enum(['educadora', 'directora']);
export type Grupo = z.infer<typeof GrupoSchema>;

/**
 * Núcleo de aprendizaje del dataset E1 por núcleos (`IA`, `CC`, `LV`…). El catálogo es
 * ampliable: se valida el formato del código y la lista vigente viene de `GET /nucleos`.
 */
export const NucleoSchema = z.string().regex(/^[A-Z]{2}$/);
export type Nucleo = z.infer<typeof NucleoSchema>;

/** Sala Cuna, Nivel Medio o Transición. */
export const NivelEducativoSchema = z.enum(['SC', 'NM', 'TR']);
export type NivelEducativo = z.infer<typeof NivelEducativoSchema>;

/** Formatos que la app registra (el dataset además trae `video`, solo como metadato). */
export const FormatoCapturaSchema = z.enum(['texto', 'audio', 'foto']);
export type FormatoCaptura = z.infer<typeof FormatoCapturaSchema>;

/** procesando → borrador_listo → confirmada | descartada; error si el pipeline falla. */
export const EstadoCapturaSchema = z.enum([
  'procesando',
  'borrador_listo',
  'confirmada',
  'descartada',
  'error',
]);
export type EstadoCaptura = z.infer<typeof EstadoCapturaSchema>;

/** Nivel 1–8 dentro de un núcleo y nivel educativo; no se compara entre núcleos. */
export const NivelSchema = z.number().int().min(1).max(8);

// ---- Identidad ----

export const MeResponseSchema = z.object({
  id: z.string(),
  email: TextoNuloSchema,
  nombre: TextoNuloSchema,
  grupo: GrupoSchema,
  idJardin: z.string(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

// ---- Catálogo ----

export const NinoSchema = z.object({
  id: z.string(),
  /** Primera palabra del nombre completo ficticio. */
  nombres: z.string(),
  /** Resto del nombre completo ficticio. */
  apellidos: z.string(),
  nombreCompleto: z.string(),
  /** Código local de la sala (`SC-01`). */
  sala: z.string(),
  idSala: z.string(),
  nivelEducativo: NivelEducativoSchema,
  fechaNacimiento: FechaSchema,
  /** Edad en meses completos a hoy. */
  edadMeses: z.number().int(),
});
export type Nino = z.infer<typeof NinoSchema>;

export const NinosQuerySchema = z.object({ sala: z.string().min(1).optional() });
export const NinosResponseSchema = z.array(NinoSchema);

/** Componente de un descriptor de la rúbrica: su conducta o uno de sus dos ejemplos. */
export const ManifestacionSchema = z.object({
  id: z.string(),
  idDescriptor: z.string(),
  nucleo: NucleoSchema,
  nivelEducativo: NivelEducativoSchema,
  nivel: NivelSchema,
  tipo: z.enum(['conducta_descriptor', 'ejemplo_ilustrativo']),
  textoObservable: z.string(),
});
export type Manifestacion = z.infer<typeof ManifestacionSchema>;

export const ManifestacionesQuerySchema = z.object({
  nivel: z.coerce.number().int().min(1).max(8).optional(),
  nucleo: NucleoSchema.optional(),
  nivelEducativo: NivelEducativoSchema.optional(),
});
export const ManifestacionesResponseSchema = z.array(ManifestacionSchema);

/** Nombre ordinal de un nivel; no tiene edades ni es un umbral de logro. */
export const NivelRutaSchema = z.object({
  nivel: NivelSchema,
  nombre: z.string(),
});
export type NivelRuta = z.infer<typeof NivelRutaSchema>;

/** Núcleo del catálogo; `origen` separa la referencia aportada de las propuestas sintéticas. */
export const NucleoCatalogoSchema = z.object({
  id: NucleoSchema,
  nombre: z.string(),
  ambito: z.string(),
  origen: z.string(),
});
export type NucleoCatalogo = z.infer<typeof NucleoCatalogoSchema>;

/** Manifestación con la cita textual que la respalda. */
export const ManifestacionCitadaSchema = z
  .object({ manifestacion: ManifestacionSchema, cita: z.string().nullable() })
  .meta({ id: 'ManifestacionCitada' });

// ---- Capturas ----

/** Tipos de archivo aceptados: los que admiten Transcribe (audio) y la lectura de fotos. */
export const TIPOS_ARCHIVO = {
  'audio/webm': { formato: 'audio', extension: 'webm' },
  'audio/ogg': { formato: 'audio', extension: 'ogg' },
  'audio/mp4': { formato: 'audio', extension: 'm4a' },
  'audio/mpeg': { formato: 'audio', extension: 'mp3' },
  'audio/wav': { formato: 'audio', extension: 'wav' },
  'image/jpeg': { formato: 'foto', extension: 'jpg' },
  'image/png': { formato: 'foto', extension: 'png' },
} as const satisfies Record<string, { formato: FormatoCaptura; extension: string }>;

export const TipoArchivoSchema = z.enum(
  Object.keys(TIPOS_ARCHIVO) as [keyof typeof TIPOS_ARCHIVO, ...(keyof typeof TIPOS_ARCHIVO)[]],
);
export type TipoArchivo = z.infer<typeof TipoArchivoSchema>;

export const TAMANO_MAXIMO_ARCHIVO = 10 * 1024 * 1024;

/** `texto` para formato texto; `archivo` (tipo MIME sin parámetros y bytes) para audio o foto. */
export const CrearCapturaRequestSchema = z
  .object({
    idNino: z.string().min(1),
    formato: FormatoCapturaSchema,
    texto: z.string().trim().min(1).max(5000).optional(),
    archivo: z
      .object({
        tipo: TipoArchivoSchema,
        tamano: z.number().int().positive().max(TAMANO_MAXIMO_ARCHIVO),
      })
      .optional(),
  })
  .superRefine((datos, ctx) => {
    const campo = datos.formato === 'texto' ? 'texto' : 'archivo';
    const sobrante = datos.formato === 'texto' ? 'archivo' : 'texto';
    if (datos[campo] === undefined) {
      ctx.addIssue({ code: 'custom', path: [campo], message: `obligatorio para ${datos.formato}` });
    }
    if (datos[sobrante] !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: [sobrante],
        message: `no corresponde a ${datos.formato}`,
      });
    }
    if (datos.archivo && TIPOS_ARCHIVO[datos.archivo.tipo].formato !== datos.formato) {
      ctx.addIssue({
        code: 'custom',
        path: ['archivo', 'tipo'],
        message: `no es ${datos.formato}`,
      });
    }
  });
export type CrearCapturaRequest = z.infer<typeof CrearCapturaRequestSchema>;

/**
 * Subida directa a S3: `PUT` del archivo a `url` con exactamente estas cabeceras.
 * S3 rechaza la subida si cambia el tipo o el tamaño declarado.
 */
export const SubidaSchema = z
  .object({
    url: z.url(),
    metodo: z.literal('PUT'),
    cabeceras: z.record(z.string(), z.string()),
    expiraEn: z.iso.datetime(),
  })
  .meta({ id: 'Subida' });

/**
 * Qué se procesó y cómo: la entrada y el estado de cada paso del pipeline. Mientras falten
 * Transcribe, la lectura de imágenes o Bedrock, esos pasos se declaran `no_implementado` o
 * `simulado` para que la interfaz lo diga.
 */
export const ProcesamientoSchema = z
  .object({
    /** true si algún paso no es real (no implementado o simulado). */
    simulado: z.boolean(),
    entrada: z.object({
      formato: FormatoCapturaSchema,
      /** Tipo MIME del archivo; null para texto. */
      tipoArchivo: z.string().nullable(),
      /** Tamaño del archivo en S3 o del texto, en bytes. */
      bytes: z.number().int().nonnegative(),
      /** Clave del objeto en S3; null si no hay archivo. */
      claveS3: z.string().nullable(),
    }),
    pasos: z.array(
      z.object({
        paso: z.enum(['transcripcion', 'lectura_imagen', 'extraccion']),
        estado: z.enum(['no_implementado', 'simulado', 'completado']),
        detalle: z.string(),
      }),
    ),
    /** Decisiones previas del jardín que recibió la IA como ejemplos; ausente en borradores antiguos. */
    ejemplosUsados: z.number().int().nonnegative().optional(),
  })
  .meta({ id: 'Procesamiento' });
export type Procesamiento = z.infer<typeof ProcesamientoSchema>;

export const BorradorSchema = z
  .object({
    /** Texto normalizado del que salen las citas. */
    textoFuente: z.string(),
    /** Estimación pedagógica, no un diagnóstico; null con evidencia insuficiente. */
    nivelSugerido: NivelSchema.nullable(),
    evidenciaInsuficiente: z.boolean(),
    manifestaciones: z.array(ManifestacionCitadaSchema),
    proveedor: z.string(),
    /** null en borradores anteriores a este campo. */
    procesamiento: ProcesamientoSchema.nullable(),
  })
  .meta({ id: 'Borrador' });
export type Borrador = z.infer<typeof BorradorSchema>;

export const ObservacionConfirmadaSchema = z
  .object({
    id: z.string(),
    fecha: FechaSchema,
    /** Nivel validado por la educadora. */
    nivel: NivelSchema,
    /** Núcleos de las manifestaciones; cada uno tiene su valoración de la app. */
    nucleos: z.array(NucleoSchema),
    manifestaciones: z.array(ManifestacionCitadaSchema),
  })
  .meta({ id: 'ObservacionConfirmada' });
export type ObservacionConfirmada = z.infer<typeof ObservacionConfirmadaSchema>;

export const NinoRefSchema = NinoSchema.pick({
  id: true,
  nombres: true,
  apellidos: true,
  sala: true,
  nivelEducativo: true,
}).meta({ id: 'NinoRef' });

export const CapturaResumenSchema = z
  .object({
    id: z.uuid(),
    nino: NinoRefSchema,
    autor: z.string(),
    formato: FormatoCapturaSchema,
    estado: EstadoCapturaSchema,
    creadoEn: z.iso.datetime(),
    /** Primeros caracteres del texto escrito o normalizado. */
    extracto: TextoNuloSchema,
    /** Núcleos de lo confirmado o, si aún no se confirma, de lo sugerido. */
    nucleos: z.array(NucleoSchema),
    /** Nivel confirmado por la educadora; null si aún no se confirma. */
    nivel: NivelSchema.nullable(),
  })
  .meta({ id: 'CapturaResumen' });
export type CapturaResumen = z.infer<typeof CapturaResumenSchema>;

export const CapturaDetalleSchema = z.object({
  id: z.uuid(),
  nino: NinoRefSchema,
  autor: z.string(),
  formato: FormatoCapturaSchema,
  estado: EstadoCapturaSchema,
  creadoEn: z.iso.datetime(),
  texto: TextoNuloSchema,
  tieneArchivo: z.boolean(),
  errorDetalle: TextoNuloSchema,
  /** Sugerencia de la IA, presente desde `borrador_listo`. */
  borrador: BorradorSchema.nullable(),
  /** Presente si se confirmó. */
  observacion: ObservacionConfirmadaSchema.nullable(),
});
export type CapturaDetalle = z.infer<typeof CapturaDetalleSchema>;

export const CrearCapturaResponseSchema = z.object({
  captura: CapturaDetalleSchema,
  /** Solo para audio o foto. */
  subida: SubidaSchema.nullable(),
});
export type CrearCapturaResponse = z.infer<typeof CrearCapturaResponseSchema>;

export const ListarCapturasQuerySchema = z.object({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
  sala: z.string().min(1).optional(),
  idNino: z.string().min(1).optional(),
  estado: EstadoCapturaSchema.optional(),
  /** Solo las registradas por quien consulta. */
  mias: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListarCapturasQuery = z.infer<typeof ListarCapturasQuerySchema>;

export const ListarCapturasResponseSchema = z.object({
  items: z.array(CapturaResumenSchema),
  total: z.number().int(),
  pagina: z.number().int(),
  tamano: z.number().int(),
});
export type ListarCapturasResponse = z.infer<typeof ListarCapturasResponseSchema>;

/**
 * Decisión de la educadora: 1 a 5 manifestaciones del catálogo, todas del nivel elegido y del
 * nivel educativo del niño o niña. Se crea una valoración por cada núcleo presente.
 */
export const ConfirmacionRequestSchema = z.object({
  nivel: NivelSchema,
  manifestaciones: z
    .array(z.object({ idManifestacion: z.string().min(1), cita: z.string().min(1).optional() }))
    .min(1)
    .max(5)
    .refine((lista) => new Set(lista.map((m) => m.idManifestacion)).size === lista.length, {
      message: 'manifestaciones repetidas',
    }),
});
export type ConfirmacionRequest = z.infer<typeof ConfirmacionRequestSchema>;

export const ArchivoResponseSchema = z.object({
  url: z.url(),
  tipo: z.string(),
  expiraEn: z.iso.datetime(),
});
export type ArchivoResponse = z.infer<typeof ArchivoResponseSchema>;

// ---- Pipeline (endpoint interno) ----

/** Borrador que entrega el pipeline. Las citas deben aparecer literalmente en `textoFuente`. */
export const BorradorEntranteSchema = z.object({
  /** Texto anonimizado: el que recibe el modelo y del que salen las citas. */
  textoFuente: z.string().min(1),
  /**
   * Transcripción o lectura de la foto antes de anonimizar. La API lo guarda como texto de la
   * captura (si no lo tiene) para que la educadora vea los nombres; nunca va al modelo.
   */
  textoOriginal: z.string().min(1).optional(),
  nivelSugerido: NivelSchema.nullable(),
  evidenciaInsuficiente: z.boolean(),
  manifestaciones: z
    .array(z.object({ idManifestacion: z.string().min(1), cita: z.string().min(1) }))
    .max(5),
  proveedor: z.string().min(1),
  modelo: z.string().min(1).optional(),
  procesamiento: ProcesamientoSchema.optional(),
});
export type BorradorEntrante = z.infer<typeof BorradorEntranteSchema>;

export const ErrorPipelineRequestSchema = z.object({ detalle: z.string().min(1).max(500) });

export const CapturaEstadoResponseSchema = z.object({ id: z.uuid(), estado: EstadoCapturaSchema });

// ---- Trayectoria ----

export const TrayectoriaQuerySchema = z.object({
  desde: FechaSchema.optional(),
  hasta: FechaSchema.optional(),
});

export const OrigenSchema = z.enum(['dataset', 'app']);

/** Estados de una valoración (metodología del dataset E1 por núcleos). */
export const EstadoValoracionSchema = z.enum([
  'confirmada',
  'ajustada',
  'pendiente_revision',
  'propuesta_pendiente',
  'evidencia_insuficiente',
  'sin_registro',
]);
export type EstadoValoracion = z.infer<typeof EstadoValoracionSchema>;

/** Manifestación con el fragmento literal de la observación que la respalda. */
export const EvidenciaSchema = z
  .object({
    id: z.string(),
    manifestacion: ManifestacionSchema,
    fragmento: z.string().nullable(),
    alcance: z.enum(['componente_observado', 'parcial_otro_descriptor']),
  })
  .meta({ id: 'Evidencia' });

/** Observación del periodo con su evidencia (dataset o confirmada en la app). */
export const ObservacionTrayectoriaSchema = z
  .object({
    id: z.string(),
    fecha: FechaSchema,
    /** El dataset además admite `video`, solo como metadato. */
    formato: z.enum(['texto', 'audio', 'foto', 'video']),
    origen: OrigenSchema,
    notaBreve: z.string().nullable(),
    /** Registro completo; null en observaciones de la app sin texto. */
    textoObservacion: z.string().nullable(),
    manifestaciones: z.array(ManifestacionSchema),
    evidencias: z.array(EvidenciaSchema),
  })
  .meta({ id: 'ObservacionTrayectoria' });
export type ObservacionTrayectoria = z.infer<typeof ObservacionTrayectoriaSchema>;

/**
 * Decisión sobre un núcleo a una fecha de corte. Sin nivel validado no se muestra la sugerencia
 * como si lo fuera; sin nivel sugerido, la evidencia no alcanzó para proponer.
 */
export const ValoracionSchema = z
  .object({
    id: z.string(),
    fechaCorte: FechaSchema,
    nivelSugerido: NivelSchema.nullable(),
    nivelValidado: NivelSchema.nullable(),
    estado: EstadoValoracionSchema,
    origen: OrigenSchema,
  })
  .meta({ id: 'Valoracion' });
export type Valoracion = z.infer<typeof ValoracionSchema>;

export const TrayectoriaResponseSchema = z.object({
  nino: NinoSchema,
  desde: FechaSchema,
  hasta: FechaSchema,
  totalObservaciones: z.number().int(),
  /** Menos de 3 observaciones en el periodo: mostrar aviso de evidencia limitada. */
  evidenciaLimitada: z.boolean(),
  nucleos: z.array(
    z.object({
      nucleo: NucleoSchema,
      /** true: «sin registros en el periodo», que no equivale a ausencia de aprendizaje. */
      sinRegistros: z.boolean(),
      /** Valoraciones del periodo, de la más antigua a la más reciente. */
      valoraciones: z.array(ValoracionSchema),
    }),
  ),
  /** Observaciones del periodo, de la más reciente a la más antigua. */
  observaciones: z.array(ObservacionTrayectoriaSchema),
});
export type TrayectoriaResponse = z.infer<typeof TrayectoriaResponseSchema>;
