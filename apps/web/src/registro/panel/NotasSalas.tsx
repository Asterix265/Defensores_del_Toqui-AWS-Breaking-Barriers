import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import type { Nino } from '../datos';
import { useNotas, type NotaGuardada } from '../registrar';
import { descargarCsv, notasACsv } from '../reporte';
import { FiltrosPanel } from './FiltrosPanel';
import { ETIQUETA_PERIODO, desde, type Periodo } from './periodo';
import { PorRevisar } from './PorRevisar';
import { TablaNotas } from './TablaNotas';
import { BotonNuevaNota, TituloVista } from './TituloVista';

/**
 * Pestaña «Mis notas» (diseño 1e): notas confirmadas de las salas, guardadas en la API, con
 * periodo y reporte CSV. Son las observaciones que quedan en el registro del jardín.
 */
export function NotasSalas({
  ninos,
  salas,
  ahora,
  sala,
  onSala,
  onNuevaNota,
  onRevisar,
  onAbrirNota,
}: {
  ninos: Nino[];
  salas: string[];
  ahora: Date;
  sala: string | null;
  onSala: (sala: string | null) => void;
  onNuevaNota: () => void;
  /** Abre la revisión de una nota «Sin revisar» o «Con error». */
  onRevisar: (capturaId: string) => void;
  /** Abre el detalle de una nota confirmada. */
  onAbrirNota: (capturaId: string) => void;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('7dias');

  const consulta = useNotas(ninos, { estado: 'confirmada' });
  const limite = desde(periodo, ahora);
  const delPeriodo = (consulta.data ?? [])
    .filter((n) => !limite || n.creada >= limite)
    .sort((a, b) => b.creada.getTime() - a.creada.getTime());
  const salaDe = (nota: NotaGuardada) => nota.nino.sala;
  const visibles = sala ? delPeriodo.filter((n) => salaDe(n) === sala) : delPeriodo;

  const descargar = () => {
    const fecha = ahora.toISOString().slice(0, 10);
    descargarCsv(`notas-salas-${fecha}.csv`, notasACsv(visibles));
  };

  return (
    <>
      <TituloVista
        titulo="Notas de las salas"
        subtitulo={`${ETIQUETA_PERIODO[periodo]} · ${visibles.length} ${
          visibles.length === 1 ? 'nota' : 'notas'
        }`}
      >
        <Button
          variant="outlined"
          startIcon={<DownloadRounded />}
          disabled={visibles.length === 0}
          onClick={descargar}
          sx={{ minHeight: 52, px: 3, fontSize: 17, bgcolor: '#fff' }}
        >
          Descargar reporte
        </Button>
        <BotonNuevaNota onClick={onNuevaNota} />
      </TituloVista>

      <FiltrosPanel
        salas={salas}
        sala={sala}
        onSala={onSala}
        cantidadPorSala={(s) => delPeriodo.filter((n) => salaDe(n) === s).length}
        periodo={periodo}
        onPeriodo={setPeriodo}
      />

      <PorRevisar ninos={ninos} ahora={ahora} onRevisar={onRevisar} />

      {consulta.isError && (
        <Alert severity="error" sx={{ mt: 2.5, borderRadius: '14px' }}>
          No se pudieron cargar las notas. Revisa que la API esté levantada.
        </Alert>
      )}
      <TablaNotas notas={visibles} ahora={ahora} onAbrir={onAbrirNota} />
    </>
  );
}
