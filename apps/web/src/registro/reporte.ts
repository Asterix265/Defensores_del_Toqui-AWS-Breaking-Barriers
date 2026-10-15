import { ETIQUETA_DOMINIO, NINOS, type Nota } from './datos';

const COLUMNAS = ['id_nota', 'fecha', 'sala', 'educadora', 'nino', 'formato', 'area', 'nota'];

function celda(valor: string): string {
  return /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Reporte CSV de las notas visibles en el panel. Solo contiene datos sintéticos de la demo. */
export function notasACsv(notas: Nota[]): string {
  const filas = notas.map((nota) => {
    const nino = NINOS.find((n) => n.id === nota.ninoId);
    return [
      nota.id,
      nota.creada.toISOString(),
      nino?.sala ?? '',
      nota.educadora,
      nino?.nombre ?? '',
      nota.formato,
      ETIQUETA_DOMINIO[nota.area],
      nota.texto,
    ];
  });
  return [COLUMNAS, ...filas].map((fila) => fila.map(celda).join(',')).join('\n');
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
