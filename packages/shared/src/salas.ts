import { z } from 'zod';
import { FechaSchema, NivelEducativoSchema, NivelSchema, NucleoSchema } from './registro.js';

// ---- Estado de salas y del jardín (panel-directora-y-aprendizaje) ----
// Reglas de demostración de `metodologia.md` del dataset: no son criterios de Integra ni un
// diagnóstico. Una alerta pide revisión contextual; no identifica rezago clínico.

/** Mediana de posiciones ordinales: puede quedar entre dos niveles (4,5). */
const MedianaSchema = z.number().min(1).max(8).nullable();

export const EstadoSalaQuerySchema = z.object({
  sala: z.string().min(1),
  /** Fecha de corte; por defecto, hoy. */
  corte: FechaSchema.optional(),
});
export type EstadoSalaQuery = z.infer<typeof EstadoSalaQuerySchema>;

export const ResumenJardinQuerySchema = z.object({ corte: FechaSchema.optional() });

export const ResumenNucleoSchema = z
  .object({
    nucleo: NucleoSchema,
    /** Niños o niñas con una decisión validada vigente al corte. */
    conDecision: z.number().int(),
    sinDecision: z.number().int(),
    distribucion: z.array(z.object({ nivel: NivelSchema, cantidad: z.number().int() })),
    mediana: MedianaSchema,
    /** Todos los niveles modales si hay empate. */
    modas: z.array(NivelSchema),
  })
  .meta({ id: 'ResumenNucleo' });
export type ResumenNucleo = z.infer<typeof ResumenNucleoSchema>;

/** Nivel validado vigente de un niño o niña en un núcleo. */
export const NivelVigenteSchema = z
  .object({
    idNino: z.string(),
    nucleo: NucleoSchema,
    nivel: NivelSchema,
    fechaCorte: FechaSchema,
  })
  .meta({ id: 'NivelVigente' });
export type NivelVigente = z.infer<typeof NivelVigenteSchema>;

/** Brecha individual relativa a la sala: la referencia es la mediana de los pares. */
export const AlertaIndividualSchema = z
  .object({
    idNino: z.string(),
    nucleo: NucleoSchema,
    nivelValidado: NivelSchema,
    referencia: z.number(),
    brecha: z.number(),
    pares: z.number().int(),
  })
  .meta({ id: 'AlertaIndividual' });
export type AlertaIndividual = z.infer<typeof AlertaIndividualSchema>;

/** Brecha de una sala frente a las otras salas del mismo nivel educativo del jardín. */
export const AlertaSalaSchema = z
  .object({
    nucleo: NucleoSchema,
    mediana: z.number(),
    referencia: z.number(),
    brecha: z.number(),
    salasReferencia: z.number().int(),
  })
  .meta({ id: 'AlertaSala' });
export type AlertaSala = z.infer<typeof AlertaSalaSchema>;

export const ReglasAlertaSchema = z
  .object({
    antiguedadMaximaDias: z.number().int(),
    paresMinimos: z.number().int(),
    brechaIndividual: z.number(),
    salasMinimas: z.number().int(),
    brechaSala: z.number(),
    accionIndividual: z.string(),
    accionSala: z.string(),
  })
  .meta({ id: 'ReglasAlerta' });
export type ReglasAlerta = z.infer<typeof ReglasAlertaSchema>;

export const EstadoSalaResponseSchema = z.object({
  sala: z.string(),
  idSala: z.string(),
  nivelEducativo: NivelEducativoSchema,
  corte: FechaSchema,
  matriculados: z.number().int(),
  nucleos: z.array(ResumenNucleoSchema),
  niveles: z.array(NivelVigenteSchema),
  alertas: z.array(AlertaIndividualSchema),
  reglas: ReglasAlertaSchema,
});
export type EstadoSalaResponse = z.infer<typeof EstadoSalaResponseSchema>;

export const ResumenSalaSchema = z
  .object({
    sala: z.string(),
    idSala: z.string(),
    nivelEducativo: NivelEducativoSchema,
    matriculados: z.number().int(),
    /** Edades en meses completos al corte; null sin matrícula. */
    edadMinMeses: z.number().int().nullable(),
    edadMaxMeses: z.number().int().nullable(),
    edadPromedioMeses: z.number().nullable(),
    /** Decisiones vigentes / (matriculados × núcleos), entre 0 y 1. */
    cobertura: z.number(),
    /** Observaciones (dataset y app) de los 30 días anteriores al corte. */
    observaciones30Dias: z.number().int(),
    alertasIndividuales: z.number().int(),
    ninosConAlerta: z.number().int(),
    nucleos: z.array(ResumenNucleoSchema),
    alertasSala: z.array(AlertaSalaSchema),
  })
  .meta({ id: 'ResumenSala' });
export type ResumenSala = z.infer<typeof ResumenSalaSchema>;

export const ResumenJardinResponseSchema = z.object({
  idJardin: z.string(),
  corte: FechaSchema,
  salas: z.array(ResumenSalaSchema),
  reglas: ReglasAlertaSchema,
});
export type ResumenJardinResponse = z.infer<typeof ResumenJardinResponseSchema>;
