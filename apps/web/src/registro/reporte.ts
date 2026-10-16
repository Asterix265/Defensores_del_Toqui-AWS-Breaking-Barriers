import { etiquetaSala } from './api';
import { ETIQUETA_NUCLEO } from './datos';
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

/** Separador de Excel en español (con `,` Excel junta todo en una columna). */
const SEPARADOR = ';';

function celda(valor: string): string {
  return /[",\n\r;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** CSV con encabezado; cada celda se escapa si trae comillas, separadores o saltos de línea. */
export function aCsv(columnas: string[], filas: string[][]): string {
  return [columnas, ...filas].map((fila) => fila.map(celda).join(SEPARADOR)).join('\r\n');
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
