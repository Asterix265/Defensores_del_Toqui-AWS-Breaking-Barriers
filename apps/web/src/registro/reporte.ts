import { etiquetaSala } from './api';
import { ETIQUETA_NUCLEO, NUCLEOS, type Nino, type Nucleo } from './datos';
import type { EstadoNino, ResumenSala } from './niveles';
import type { NotaGuardada } from './registrar';

const COLUMNAS = [
  'id_nota',
  'fecha',
  'sala',
  'educadora',
  'id_nino',
  'nino',
  'formato',
  'nivel_estimado',
  'areas',
  'nota',
];

function celda(valor: string): string {
  return /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** CSV con encabezado; escapa las celdas con comillas, comas, punto y coma o saltos de línea. */
export function aCsv(columnas: string[], filas: string[][]): string {
  return [columnas, ...filas].map((fila) => fila.map(celda).join(',')).join('\n');
}

/** Número con punto decimal (para planillas), o vacío si no hay valor. */
function decimal(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(Math.round(valor * 10) / 10);
}

/** Reporte CSV de las notas visibles en el panel. Solo contiene datos sintéticos de la demo. */
export function notasACsv(notas: NotaGuardada[]): string {
  const filas = notas.map((nota) => {
    return [
      nota.id,
      nota.creada.toISOString(),
      etiquetaSala(nota.nino.sala),
      nota.autor,
      nota.nino.id,
      nota.nino.nombreCompleto,
      nota.formato,
      nota.nivel === null ? '' : String(nota.nivel),
      nota.nucleos.map((d) => ETIQUETA_NUCLEO[d]).join(' | '),
      nota.texto ?? '',
    ];
  });
  return aCsv(COLUMNAS, filas);
}

/**
 * Estado de los niños y niñas: nivel estimado por núcleo, promedio y núcleos bajo su sala.
 * Los niveles son estimaciones pedagógicas, no diagnósticos; vacío significa sin registros.
 */
export function ninosACsv(
  ninos: Nino[],
  estados: Map<string, EstadoNino>,
  rezagos: Map<string, Nucleo[]>,
  sinNotas: Map<string, number>,
): string {
  const columnas = [
    'id_nino',
    'nino',
    'sala',
    'nivel_educativo',
    'edad_meses',
    ...NUCLEOS.map((n) => `nivel_${n}`),
    'nivel_promedio_simple',
    'para_revisar',
    'nucleos_bajo_su_sala',
    'areas_sin_notas_30_dias',
  ];
  const filas = ninos.map((n) => {
    const estado = estados.get(n.id);
    const bajo = rezagos.get(n.id) ?? [];
    return [
      n.id,
      n.nombreCompleto,
      etiquetaSala(n.sala),
      n.nivelEducativo,
      String(n.edadMeses),
      ...NUCLEOS.map((nucleo) => String(estado?.niveles[nucleo]?.nivel ?? '')),
      decimal(estado?.promedio),
      bajo.length ? 'si' : 'no',
      bajo.map((d) => ETIQUETA_NUCLEO[d]).join(' | '),
      String(sinNotas.get(n.id) ?? ''),
    ];
  });
  return aCsv(columnas, filas);
}

/** Resumen por sala de la vista general del jardín. */
export function salasACsv(salas: (ResumenSala & { notas7Dias: number })[]): string {
  const columnas = [
    'sala',
    'nivel_educativo',
    'ninos',
    'edad_min_meses',
    'edad_max_meses',
    'edad_promedio_meses',
    'nivel_promedio_simple',
    'para_revisar',
    'sin_nivel',
    'notas_7_dias',
  ];
  const filas = salas.map((s) => [
    etiquetaSala(s.sala),
    s.nivelEducativo ?? '',
    String(s.ninos),
    String(s.edadMin ?? ''),
    String(s.edadMax ?? ''),
    decimal(s.edadPromedio),
    decimal(s.nivelPromedio),
    String(s.paraRevisar),
    String(s.sinNivel),
    String(s.notas7Dias),
  ]);
  return aCsv(columnas, filas);
}

export function descargarCsv(nombreArchivo: string, contenido: string) {
  // El BOM hace que Excel reconozca los acentos.
  const blob = new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
