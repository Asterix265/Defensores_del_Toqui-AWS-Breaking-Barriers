import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { aColumnaFecha } from '../comun/fechas';

/** CSV del dataset E1 por núcleos (v1.0.0) que usa la carga, en orden de inserción. */
export const ARCHIVOS = [
  'niveles_educativos.csv',
  'nucleos.csv',
  'niveles_trayectoria.csv',
  'versiones_rubrica.csv',
  'jardines.csv',
  'educadoras.csv',
  'salas.csv',
  'personal_salas.csv',
  'ninos.csv',
  'ruta_niveles.csv',
  'manifestaciones.csv',
  'observaciones.csv',
  'observacion_manifestaciones.csv',
  'valoraciones.csv',
  'valoracion_evidencias.csv',
] as const;
type Archivo = (typeof ARCHIVOS)[number];

/** Conteos de la v1.0.0 (README del dataset); otra versión solo se informa como diferencia. */
export const CONTEOS_ESPERADOS = {
  nivelesEducativos: 3,
  nucleos: 8,
  nivelesTrayectoria: 8,
  versiones: 1,
  jardines: 3,
  educadoras: 57,
  salas: 18,
  personalSalas: 54,
  ninos: 252,
  descriptores: 192,
  manifestaciones: 576,
  observaciones: 11400,
  evidencias: 13026,
  valoraciones: 5760,
  valoracionEvidencias: 13026,
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
const texto = z.string().min(1);
/** Celda vacía → null (el diccionario no usa 0 ni «desconocido» como sustitutos). */
const opcional = z.string().transform((v) => (v === '' ? null : v));
const fechaOpcional = z.union([z.literal('').transform(() => null), fecha]);
const nivel = entero.min(1).max(8);
const nivelOpcional = z.union([z.literal('').transform(() => null), nivel]);
const nivelEducativo = z.enum(['SC', 'NM', 'TR']);
const idNucleo = z.string().regex(/^[A-Z]{2}$/);

const Esquemas = {
  nivelesEducativos: z.object({
    id_nivel_educativo: nivelEducativo,
    nombre: texto,
    edad_min_meses_contexto: entero.min(0),
    edad_max_meses_exclusiva_contexto: entero.min(1),
  }),
  nucleos: z.object({
    id_nucleo: idNucleo,
    nombre: texto,
    ambito: texto,
    archivo_rubrica: texto,
    origen: texto,
  }),
  nivelesTrayectoria: z.object({ nivel, nombre_nivel: texto }),
  versiones: z.object({
    id_version: texto,
    fecha_version: fecha,
    estado: texto,
    archivo_referencia: texto,
    nucleos_activos: entero.min(1),
    niveles_activos: entero.min(1),
  }),
  jardines: z.object({
    id_jardin: z.string().regex(/^JAR-\d{4}$/),
    nombre_fantasia: texto,
    comuna: texto,
    region: texto,
    numero_salas: entero.min(1).max(30),
    numero_educadoras: entero.min(0),
    numero_asistentes: entero.min(0),
    id_directora: opcional,
  }),
  educadoras: z.object({
    id_educadora: texto,
    id_jardin: texto,
    nombre_completo: texto,
    rol: z.enum(['educadora_parvulos', 'asistente_parvulos', 'directora']),
    anios_experiencia: entero.min(0).max(50),
  }),
  salas: z.object({
    id_sala: texto,
    id_jardin: texto,
    sala_grupo: texto,
    id_nivel_educativo: nivelEducativo,
    id_educadora_responsable: texto,
  }),
  personalSalas: z.object({ id_educadora: texto, id_sala: texto }),
  ninos: z.object({
    id_nino: z.string().regex(/^NINO-\d{5}$/),
    nombre_completo: texto,
    nombre_registro: texto,
    fecha_nacimiento: fecha,
    sexo_registrado: z.enum(['f', 'm', 'x', 'no_informado']),
    id_jardin: texto,
    sala_grupo: texto,
    id_sala: texto,
    id_nivel_educativo: nivelEducativo,
    fecha_ingreso: fecha,
  }),
  descriptores: z.object({
    id_descriptor: texto,
    id_version: texto,
    id_nivel_educativo: nivelEducativo,
    id_nucleo: idNucleo,
    nivel,
    nombre_nivel: texto,
    desarrollo_esperado: texto,
    conducta_observable: texto,
    ejemplo_1: texto,
    ejemplo_2: texto,
    origen: texto,
    paso_siguiente_sugerido: opcional,
  }),
  manifestaciones: z.object({
    id_manifestacion: texto,
    id_descriptor: texto,
    tipo: z.enum(['conducta_descriptor', 'ejemplo_ilustrativo']),
    texto_observable: texto,
    origen: texto,
  }),
  observaciones: z.object({
    id_observacion: z.string().regex(/^OBS-\d{7}$/),
    id_nino: texto,
    id_educadora: texto,
    fecha_observacion: fecha,
    formato_captura: z.enum(['video', 'audio', 'texto', 'foto']),
    nota_breve: z.string().max(280),
    texto_observacion: texto,
    contexto: opcional,
    apoyos: opcional,
    edad_meses_observacion: entero.min(0),
    origen: texto,
  }),
  evidencias: z.object({
    id_evidencia: texto,
    id_observacion: texto,
    id_manifestacion: texto,
    fragmento_evidencia: texto,
    alcance: z.enum(['componente_observado', 'parcial_otro_descriptor']),
  }),
  valoraciones: z.object({
    id_valoracion: texto,
    id_nino: texto,
    id_sala: texto,
    id_nivel_educativo: nivelEducativo,
    id_nucleo: idNucleo,
    id_version: texto,
    fecha_corte: fecha,
    nivel_sugerido: nivelOpcional,
    nivel_validado: nivelOpcional,
    estado: z.enum([
      'confirmada',
      'ajustada',
      'pendiente_revision',
      'propuesta_pendiente',
      'evidencia_insuficiente',
      'sin_registro',
    ]),
    id_educadora_decide: opcional,
    fecha_decision: fechaOpcional,
    id_observacion_sin_clasificar: opcional,
    justificacion_sugerencia: opcional,
    justificacion_decision: opcional,
    paso_siguiente_sugerido: opcional,
  }),
  valoracionEvidencias: z.object({
    id_valoracion: texto,
    id_evidencia: texto,
    uso: z.enum(['sustento_propuesta', 'contraste_parcial']),
  }),
};

type Clave = keyof typeof Esquemas;
type Dataset = { [K in Clave]: z.infer<(typeof Esquemas)[K]>[] };

const ARCHIVO_DE: Record<Clave, Archivo> = {
  nivelesEducativos: 'niveles_educativos.csv',
  nucleos: 'nucleos.csv',
  nivelesTrayectoria: 'niveles_trayectoria.csv',
  versiones: 'versiones_rubrica.csv',
  jardines: 'jardines.csv',
  educadoras: 'educadoras.csv',
  salas: 'salas.csv',
  personalSalas: 'personal_salas.csv',
  ninos: 'ninos.csv',
  descriptores: 'ruta_niveles.csv',
  manifestaciones: 'manifestaciones.csv',
  observaciones: 'observaciones.csv',
  evidencias: 'observacion_manifestaciones.csv',
  valoraciones: 'valoraciones.csv',
  valoracionEvidencias: 'valoracion_evidencias.csv',
};

/** Lee y valida todos los CSV antes de tocar la base. Cualquier problema detiene la carga. */
export function leerDataset(dir: string | undefined): Dataset {
  if (!dir) throw new Error('DATASET_DIR no está definida');
  const faltantes = ARCHIVOS.filter((a) => !existsSync(join(dir, a)));
  if (faltantes.length) {
    throw new Error(`DATASET_DIR (${dir}) no contiene: ${faltantes.join(', ')}`);
  }
  const leer = <K extends Clave>(clave: K): Dataset[K] =>
    parsearCsv(readFileSync(join(dir, ARCHIVO_DE[clave]), 'utf8')).map((fila, i) => {
      const r = Esquemas[clave].safeParse(fila);
      if (!r.success) {
        throw new Error(`${ARCHIVO_DE[clave]}, fila ${i + 2}: ${z.prettifyError(r.error)}`);
      }
      return r.data as Dataset[K][number];
    }) as Dataset[K];
  const datos = Object.fromEntries(
    (Object.keys(Esquemas) as Clave[]).map((clave) => [clave, leer(clave)]),
  ) as Dataset;
  validarRelaciones(datos);
  return datos;
}

/**
 * Claves foráneas internas y fragmentos literales. Junta todos los problemas (hasta 20) para
 * informarlos de una vez.
 */
export function validarRelaciones(d: Dataset): void {
  const problemas: string[] = [];
  const ids = <T>(filas: T[], clave: (f: T) => string) => new Set(filas.map(clave));
  const nivelesEd = ids(d.nivelesEducativos, (f) => f.id_nivel_educativo);
  const nucleos = ids(d.nucleos, (f) => f.id_nucleo);
  const niveles = new Set(d.nivelesTrayectoria.map((f) => f.nivel));
  const versiones = ids(d.versiones, (f) => f.id_version);
  const jardines = ids(d.jardines, (f) => f.id_jardin);
  const personas = ids(d.educadoras, (f) => f.id_educadora);
  const salas = new Map(d.salas.map((s) => [s.id_sala, s]));
  const ninos = ids(d.ninos, (f) => f.id_nino);
  const descriptores = ids(d.descriptores, (f) => f.id_descriptor);
  const manifestaciones = ids(d.manifestaciones, (f) => f.id_manifestacion);
  const observaciones = new Map(d.observaciones.map((o) => [o.id_observacion, o]));
  const evidencias = ids(d.evidencias, (f) => f.id_evidencia);
  const valoraciones = ids(d.valoraciones, (f) => f.id_valoracion);

  const exigir = (existe: boolean, archivo: Archivo, id: string, campo: string, valor: string) => {
    if (!existe) problemas.push(`${archivo}, ${id}: ${campo} ${valor} no existe`);
  };
  for (const j of d.jardines) {
    if (j.id_directora) {
      exigir(
        personas.has(j.id_directora),
        'jardines.csv',
        j.id_jardin,
        'id_directora',
        j.id_directora,
      );
    }
  }
  for (const e of d.educadoras) {
    exigir(jardines.has(e.id_jardin), 'educadoras.csv', e.id_educadora, 'id_jardin', e.id_jardin);
  }
  for (const s of d.salas) {
    exigir(jardines.has(s.id_jardin), 'salas.csv', s.id_sala, 'id_jardin', s.id_jardin);
    exigir(
      nivelesEd.has(s.id_nivel_educativo),
      'salas.csv',
      s.id_sala,
      'id_nivel_educativo',
      s.id_nivel_educativo,
    );
    exigir(
      personas.has(s.id_educadora_responsable),
      'salas.csv',
      s.id_sala,
      'id_educadora_responsable',
      s.id_educadora_responsable,
    );
  }
  for (const p of d.personalSalas) {
    const id = `${p.id_educadora}/${p.id_sala}`;
    exigir(personas.has(p.id_educadora), 'personal_salas.csv', id, 'id_educadora', p.id_educadora);
    exigir(salas.has(p.id_sala), 'personal_salas.csv', id, 'id_sala', p.id_sala);
  }
  for (const n of d.ninos) {
    const sala = salas.get(n.id_sala);
    exigir(sala !== undefined, 'ninos.csv', n.id_nino, 'id_sala', n.id_sala);
    if (
      sala &&
      (sala.id_jardin !== n.id_jardin ||
        sala.sala_grupo !== n.sala_grupo ||
        sala.id_nivel_educativo !== n.id_nivel_educativo)
    ) {
      problemas.push(
        `ninos.csv, ${n.id_nino}: jardín, sala o nivel educativo no calzan con ${n.id_sala}`,
      );
    }
  }
  for (const r of d.descriptores) {
    exigir(
      versiones.has(r.id_version),
      'ruta_niveles.csv',
      r.id_descriptor,
      'id_version',
      r.id_version,
    );
    exigir(
      nivelesEd.has(r.id_nivel_educativo),
      'ruta_niveles.csv',
      r.id_descriptor,
      'id_nivel_educativo',
      r.id_nivel_educativo,
    );
    exigir(nucleos.has(r.id_nucleo), 'ruta_niveles.csv', r.id_descriptor, 'id_nucleo', r.id_nucleo);
    exigir(niveles.has(r.nivel), 'ruta_niveles.csv', r.id_descriptor, 'nivel', String(r.nivel));
  }
  for (const m of d.manifestaciones) {
    exigir(
      descriptores.has(m.id_descriptor),
      'manifestaciones.csv',
      m.id_manifestacion,
      'id_descriptor',
      m.id_descriptor,
    );
  }
  for (const o of d.observaciones) {
    exigir(ninos.has(o.id_nino), 'observaciones.csv', o.id_observacion, 'id_nino', o.id_nino);
    exigir(
      personas.has(o.id_educadora),
      'observaciones.csv',
      o.id_observacion,
      'id_educadora',
      o.id_educadora,
    );
  }
  for (const e of d.evidencias) {
    const obs = observaciones.get(e.id_observacion);
    exigir(
      obs !== undefined,
      'observacion_manifestaciones.csv',
      e.id_evidencia,
      'id_observacion',
      e.id_observacion,
    );
    exigir(
      manifestaciones.has(e.id_manifestacion),
      'observacion_manifestaciones.csv',
      e.id_evidencia,
      'id_manifestacion',
      e.id_manifestacion,
    );
    if (obs && !obs.texto_observacion.includes(e.fragmento_evidencia)) {
      problemas.push(
        `observacion_manifestaciones.csv, ${e.id_evidencia}: el fragmento no está literalmente en ${e.id_observacion}`,
      );
    }
  }
  for (const v of d.valoraciones) {
    const id = v.id_valoracion;
    exigir(ninos.has(v.id_nino), 'valoraciones.csv', id, 'id_nino', v.id_nino);
    exigir(salas.has(v.id_sala), 'valoraciones.csv', id, 'id_sala', v.id_sala);
    exigir(nucleos.has(v.id_nucleo), 'valoraciones.csv', id, 'id_nucleo', v.id_nucleo);
    exigir(versiones.has(v.id_version), 'valoraciones.csv', id, 'id_version', v.id_version);
    if (v.id_educadora_decide) {
      exigir(
        personas.has(v.id_educadora_decide),
        'valoraciones.csv',
        id,
        'id_educadora_decide',
        v.id_educadora_decide,
      );
    }
    if (v.id_observacion_sin_clasificar) {
      exigir(
        observaciones.has(v.id_observacion_sin_clasificar),
        'valoraciones.csv',
        id,
        'id_observacion_sin_clasificar',
        v.id_observacion_sin_clasificar,
      );
    }
  }
  for (const ve of d.valoracionEvidencias) {
    const id = `${ve.id_valoracion}/${ve.id_evidencia}`;
    exigir(
      valoraciones.has(ve.id_valoracion),
      'valoracion_evidencias.csv',
      id,
      'id_valoracion',
      ve.id_valoracion,
    );
    exigir(
      evidencias.has(ve.id_evidencia),
      'valoracion_evidencias.csv',
      id,
      'id_evidencia',
      ve.id_evidencia,
    );
  }
  if (problemas.length) {
    const mas = problemas.length > 20 ? ` (y ${problemas.length - 20} más)` : '';
    throw new Error(`Dataset inconsistente: ${problemas.slice(0, 20).join('; ')}${mas}`);
  }
}

export type ResultadoCarga =
  { cargado: true; conteos: Record<Clave, number> } | { cargado: false; motivo: string };

/** Filas por `createMany`: lejos del máximo de 65 535 parámetros de PostgreSQL. */
const LOTE = 1000;

/**
 * Carga el dataset en una transacción, conservando IDs, fechas, nombres ficticios y relaciones.
 * No hace nada si la base ya tiene jardines.
 */
export async function cargarDataset(prisma: PrismaClient, d: Dataset): Promise<ResultadoCarga> {
  if ((await prisma.jardin.count()) > 0) {
    return { cargado: false, motivo: 'la base ya tiene jardines; la carga no se repite' };
  }
  const fechaNula = (f: string | null) => (f === null ? null : aColumnaFecha(f));
  await prisma.$transaction(
    async (tx) => {
      async function insertar<T>(
        filas: T[],
        crear: (data: T[]) => Promise<unknown>,
      ): Promise<void> {
        for (let i = 0; i < filas.length; i += LOTE) await crear(filas.slice(i, i + LOTE));
      }
      await tx.nivelEducativo.createMany({
        data: d.nivelesEducativos.map((n) => ({
          id: n.id_nivel_educativo,
          nombre: n.nombre,
          edadMinMesesContexto: n.edad_min_meses_contexto,
          edadMaxMesesExclusiva: n.edad_max_meses_exclusiva_contexto,
        })),
      });
      await tx.nucleo.createMany({
        data: d.nucleos.map((n) => ({
          id: n.id_nucleo,
          nombre: n.nombre,
          ambito: n.ambito,
          archivoRubrica: n.archivo_rubrica,
          origen: n.origen,
        })),
      });
      await tx.nivelTrayectoria.createMany({
        data: d.nivelesTrayectoria.map((n) => ({ nivel: n.nivel, nombreNivel: n.nombre_nivel })),
      });
      await tx.versionRubrica.createMany({
        data: d.versiones.map((v) => ({
          id: v.id_version,
          fechaVersion: aColumnaFecha(v.fecha_version),
          estado: v.estado,
          archivoReferencia: v.archivo_referencia,
          nucleosActivos: v.nucleos_activos,
          nivelesActivos: v.niveles_activos,
        })),
      });
      await tx.jardin.createMany({
        data: d.jardines.map((j) => ({
          id: j.id_jardin,
          nombreFantasia: j.nombre_fantasia,
          comuna: j.comuna,
          region: j.region,
          numeroSalas: j.numero_salas,
          numeroEducadoras: j.numero_educadoras,
          numeroAsistentes: j.numero_asistentes,
          idDirectora: j.id_directora,
        })),
      });
      await tx.educadora.createMany({
        data: d.educadoras.map((e) => ({
          id: e.id_educadora,
          idJardin: e.id_jardin,
          nombreCompleto: e.nombre_completo,
          rol: e.rol,
          aniosExperiencia: e.anios_experiencia,
        })),
      });
      await tx.sala.createMany({
        data: d.salas.map((s) => ({
          id: s.id_sala,
          idJardin: s.id_jardin,
          salaGrupo: s.sala_grupo,
          idNivelEducativo: s.id_nivel_educativo,
          idEducadoraResponsable: s.id_educadora_responsable,
        })),
      });
      await tx.personalSala.createMany({
        data: d.personalSalas.map((p) => ({ idEducadora: p.id_educadora, idSala: p.id_sala })),
      });
      await tx.nino.createMany({
        data: d.ninos.map((n) => ({
          id: n.id_nino,
          nombreCompleto: n.nombre_completo,
          nombreRegistro: n.nombre_registro,
          fechaNacimiento: aColumnaFecha(n.fecha_nacimiento),
          sexoRegistrado: n.sexo_registrado,
          idJardin: n.id_jardin,
          salaGrupo: n.sala_grupo,
          idSala: n.id_sala,
          idNivelEducativo: n.id_nivel_educativo,
          fechaIngreso: aColumnaFecha(n.fecha_ingreso),
        })),
      });
      await tx.descriptor.createMany({
        data: d.descriptores.map((r) => ({
          id: r.id_descriptor,
          idVersion: r.id_version,
          idNivelEducativo: r.id_nivel_educativo,
          idNucleo: r.id_nucleo,
          nivel: r.nivel,
          nombreNivel: r.nombre_nivel,
          desarrolloEsperado: r.desarrollo_esperado,
          conductaObservable: r.conducta_observable,
          ejemplo1: r.ejemplo_1,
          ejemplo2: r.ejemplo_2,
          origen: r.origen,
          pasoSiguienteSugerido: r.paso_siguiente_sugerido,
        })),
      });
      await tx.manifestacion.createMany({
        data: d.manifestaciones.map((m) => ({
          id: m.id_manifestacion,
          idDescriptor: m.id_descriptor,
          tipo: m.tipo,
          textoObservable: m.texto_observable,
          origen: m.origen,
        })),
      });
      await insertar(
        d.observaciones.map((o) => ({
          id: o.id_observacion,
          idNino: o.id_nino,
          idEducadora: o.id_educadora,
          fechaObservacion: aColumnaFecha(o.fecha_observacion),
          formatoCaptura: o.formato_captura,
          notaBreve: o.nota_breve === '' ? null : o.nota_breve,
          textoObservacion: o.texto_observacion,
          contexto: o.contexto,
          apoyos: o.apoyos,
          edadMesesObservacion: o.edad_meses_observacion,
          procedencia: o.origen,
          origen: 'dataset' as const,
        })),
        (data) => tx.observacion.createMany({ data }),
      );
      await insertar(
        d.evidencias.map((e) => ({
          id: e.id_evidencia,
          idObservacion: e.id_observacion,
          idManifestacion: e.id_manifestacion,
          cita: e.fragmento_evidencia,
          alcance: e.alcance,
        })),
        (data) => tx.observacionManifestacion.createMany({ data }),
      );
      await insertar(
        d.valoraciones.map((v) => ({
          id: v.id_valoracion,
          idNino: v.id_nino,
          idSala: v.id_sala,
          idNivelEducativo: v.id_nivel_educativo,
          idNucleo: v.id_nucleo,
          idVersion: v.id_version,
          fechaCorte: aColumnaFecha(v.fecha_corte),
          nivelSugerido: v.nivel_sugerido,
          nivelValidado: v.nivel_validado,
          estado: v.estado,
          idEducadoraDecide: v.id_educadora_decide,
          fechaDecision: fechaNula(v.fecha_decision),
          idObservacionSinClasificar: v.id_observacion_sin_clasificar,
          justificacionSugerencia: v.justificacion_sugerencia,
          justificacionDecision: v.justificacion_decision,
          pasoSiguienteSugerido: v.paso_siguiente_sugerido,
          origen: 'dataset' as const,
        })),
        (data) => tx.valoracion.createMany({ data }),
      );
      await insertar(
        d.valoracionEvidencias.map((ve) => ({
          idValoracion: ve.id_valoracion,
          idEvidencia: ve.id_evidencia,
          uso: ve.uso,
        })),
        (data) => tx.valoracionEvidencia.createMany({ data }),
      );
    },
    { timeout: 300_000 },
  );
  return {
    cargado: true,
    conteos: Object.fromEntries(
      Object.entries(d).map(([clave, filas]) => [clave, filas.length]),
    ) as Record<Clave, number>,
  };
}
