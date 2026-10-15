import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { aColumnaFecha } from '../comun/fechas';
import { nombreSintetico } from './nombres';

export const ARCHIVOS = [
  'jardines.csv',
  'educadoras.csv',
  'ninos.csv',
  'ruta_niveles.csv',
  'manifestaciones.csv',
  'observaciones.csv',
  'observacion_manifestaciones.csv',
] as const;

/** Conteos esperados del dataset público E-1. */
export const CONTEOS_ESPERADOS = {
  jardines: 20,
  educadoras: 80,
  ninos: 500,
  niveles: 9,
  manifestaciones: 90,
  observaciones: 2950,
  vinculos: 8850,
};

/** CSV RFC 4180: comas, comillas dobles (con `""` escapadas) y saltos LF o CRLF. */
export function parsearCsv(contenido: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i]!;
    if (entreComillas) {
      if (c === '"' && contenido[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && contenido[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const [encabezado, ...datos] = filas.filter((f) => f.length > 1 || f[0] !== '');
  if (!encabezado) return [];
  return datos.map((f) => Object.fromEntries(encabezado.map((col, i) => [col, f[i] ?? ''])));
}

const entero = z.coerce.number().int();
const fecha = z.iso.date();
const dominio = z.enum([
  'motor_grueso',
  'motor_fino',
  'lenguaje_comunicacion',
  'socioemocional',
  'cognitivo',
]);

const Esquemas = {
  jardines: z.object({
    id_jardin: z.string().regex(/^JAR-\d{4}$/),
    nombre_fantasia: z.string().min(1),
    comuna: z.string().min(1),
    region: z.string().min(1),
    numero_salas: entero.min(1).max(12),
    numero_educadoras: entero.min(1),
  }),
  educadoras: z.object({
    id_educadora: z.string().regex(/^EDU-\d{4}$/),
    id_jardin: z.string(),
    rol: z.enum(['educadora_parvulos', 'tecnico_parvulos']),
    anios_experiencia: entero.min(0).max(35),
  }),
  ninos: z.object({
    id_nino: z.string().regex(/^NINO-\d{5}$/),
    fecha_nacimiento: fecha,
    sexo_registrado: z.enum(['f', 'm', 'x', 'no_informado']),
    id_jardin: z.string(),
    sala_grupo: z.string().min(1),
    fecha_ingreso: fecha,
  }),
  niveles: z.object({
    nivel: entero.min(1).max(9),
    nombre_nivel: z.string().min(1),
    edad_min_meses: entero.min(0).max(36),
    edad_max_meses: entero.min(0).max(36),
    dominios: z
      .string()
      .transform((v) => v.split('|'))
      .pipe(z.array(dominio).length(5)),
    descripcion: z.string().min(1),
  }),
  manifestaciones: z.object({
    id_manifestacion: z.string().regex(/^MAN-L\d{2}-[A-Z]{2}-\d{2}$/),
    nivel: entero.min(1).max(9),
    dominio,
    texto_observable: z.string().min(1),
  }),
  observaciones: z.object({
    id_observacion: z.string().regex(/^OBS-\d{7}$/),
    id_nino: z.string(),
    id_educadora: z.string(),
    fecha_observacion: fecha,
    formato_captura: z.enum(['video', 'audio', 'texto', 'foto']),
    nivel_estimado: entero.min(1).max(9),
    nota_breve: z.string().max(280),
  }),
  vinculos: z.object({ id_observacion: z.string(), id_manifestacion: z.string() }),
};

type Dataset = { [K in keyof typeof Esquemas]: z.infer<(typeof Esquemas)[K]>[] };

/** Lee y valida todos los CSV antes de tocar la base. Cualquier problema detiene la carga. */
export function leerDataset(dir: string | undefined): Dataset {
  if (!dir) throw new Error('DATASET_DIR no está definida');
  const faltantes = ARCHIVOS.filter((a) => !existsSync(join(dir, a)));
  if (faltantes.length) {
    throw new Error(`DATASET_DIR (${dir}) no contiene: ${faltantes.join(', ')}`);
  }
  const leer = <K extends keyof typeof Esquemas>(clave: K, archivo: (typeof ARCHIVOS)[number]) =>
    parsearCsv(readFileSync(join(dir, archivo), 'utf8')).map((fila, i) => {
      const r = Esquemas[clave].safeParse(fila);
      if (!r.success) throw new Error(`${archivo}, fila ${i + 2}: ${z.prettifyError(r.error)}`);
      return r.data as Dataset[K][number];
    });
  return {
    jardines: leer('jardines', 'jardines.csv'),
    educadoras: leer('educadoras', 'educadoras.csv'),
    ninos: leer('ninos', 'ninos.csv'),
    niveles: leer('niveles', 'ruta_niveles.csv'),
    manifestaciones: leer('manifestaciones', 'manifestaciones.csv'),
    observaciones: leer('observaciones', 'observaciones.csv'),
    vinculos: leer('vinculos', 'observacion_manifestaciones.csv'),
  };
}

export type ResultadoCarga =
  { cargado: true; conteos: Record<keyof Dataset, number> } | { cargado: false; motivo: string };

/**
 * Carga el dataset en una transacción, conservando IDs, fechas y relaciones. Los nombres de
 * niños, niñas y educadoras son sintéticos y deterministas (el dataset no los trae).
 */
export async function cargarDataset(prisma: PrismaClient, datos: Dataset): Promise<ResultadoCarga> {
  if ((await prisma.jardin.count()) > 0) {
    return { cargado: false, motivo: 'la base ya tiene jardines; la carga no se repite' };
  }
  await prisma.$transaction(
    async (tx) => {
      await tx.jardin.createMany({
        data: datos.jardines.map((j) => ({
          id: j.id_jardin,
          nombreFantasia: j.nombre_fantasia,
          comuna: j.comuna,
          region: j.region,
          numeroSalas: j.numero_salas,
          numeroEducadoras: j.numero_educadoras,
        })),
      });
      await tx.educadora.createMany({
        data: datos.educadoras.map((e) => ({
          id: e.id_educadora,
          idJardin: e.id_jardin,
          ...nombreSintetico(e.id_educadora, 'f'),
          rol: e.rol,
          aniosExperiencia: e.anios_experiencia,
        })),
      });
      await tx.nino.createMany({
        data: datos.ninos.map((n) => ({
          id: n.id_nino,
          ...nombreSintetico(n.id_nino, n.sexo_registrado),
          fechaNacimiento: aColumnaFecha(n.fecha_nacimiento),
          sexoRegistrado: n.sexo_registrado,
          idJardin: n.id_jardin,
          salaGrupo: n.sala_grupo,
          fechaIngreso: aColumnaFecha(n.fecha_ingreso),
        })),
      });
      await tx.nivel.createMany({
        data: datos.niveles.map((n) => ({
          nivel: n.nivel,
          nombreNivel: n.nombre_nivel,
          edadMinMeses: n.edad_min_meses,
          edadMaxMeses: n.edad_max_meses,
          dominios: n.dominios,
          descripcion: n.descripcion,
        })),
      });
      await tx.manifestacion.createMany({
        data: datos.manifestaciones.map((m) => ({
          id: m.id_manifestacion,
          nivel: m.nivel,
          dominio: m.dominio,
          textoObservable: m.texto_observable,
        })),
      });
      await tx.observacion.createMany({
        data: datos.observaciones.map((o) => ({
          id: o.id_observacion,
          idNino: o.id_nino,
          idEducadora: o.id_educadora,
          fechaObservacion: aColumnaFecha(o.fecha_observacion),
          formatoCaptura: o.formato_captura,
          nivelEstimado: o.nivel_estimado,
          notaBreve: o.nota_breve === '' ? null : o.nota_breve,
          origen: 'dataset' as const,
        })),
      });
      await tx.observacionManifestacion.createMany({
        data: datos.vinculos.map((v) => ({
          idObservacion: v.id_observacion,
          idManifestacion: v.id_manifestacion,
        })),
      });
    },
    { timeout: 120_000 },
  );
  return {
    cargado: true,
    conteos: Object.fromEntries(
      Object.entries(datos).map(([clave, filas]) => [clave, filas.length]),
    ) as Record<keyof Dataset, number>,
  };
}
