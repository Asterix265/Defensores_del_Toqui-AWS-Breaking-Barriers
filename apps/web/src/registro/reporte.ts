import { etiquetaSala } from './api';
import { ETIQUETA_DOMINIO, dominiosDe, type Nota } from './datos';

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
  'manifestaciones',
  'nota',
];

function celda(valor: string): string {
  return /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Reporte CSV de las notas visibles en el panel. Solo contiene datos sintéticos de la demo. */
export function notasACsv(notas: Nota[]): string {
  const filas = notas.map((nota) => {
    return [
      nota.id,
      nota.creada.toISOString(),
      etiquetaSala(nota.nino.sala),
      nota.educadora,
      nota.nino.id,
      nota.nino.nombreCompleto,
      nota.formato,
      String(nota.nivel),
      dominiosDe(nota.manifestaciones)
        .map((d) => ETIQUETA_DOMINIO[d])
        .join(' | '),
      nota.manifestaciones.map((m) => m.manifestacion.id).join(' | '),
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
