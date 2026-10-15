import { useState } from 'react';
import Button from '@mui/material/Button';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { NINOS, type Nota } from '../datos';
import { descargarCsv, notasACsv } from '../reporte';
import { FiltrosPanel } from './FiltrosPanel';
import { ETIQUETA_PERIODO, desde, type Periodo } from './periodo';
import { TablaNotas } from './TablaNotas';
import { BotonNuevaNota, TituloVista } from './TituloVista';

/** Pestaña «Mis notas» (diseño 1e): notas de las salas, periodo y reporte CSV. */
export function NotasSalas({
  notas,
  ahora,
  sala,
  onSala,
  onNuevaNota,
}: {
  notas: Nota[];
  ahora: Date;
  sala: string | null;
  onSala: (sala: string | null) => void;
  onNuevaNota: () => void;
}) {
  const [periodo, setPeriodo] = useState<Periodo>('7dias');

  const limite = desde(periodo, ahora);
  const delPeriodo = notas
    .filter((n) => !limite || n.creada >= limite)
    .sort((a, b) => b.creada.getTime() - a.creada.getTime());
  const salaDe = (nota: Nota) => NINOS.find((n) => n.id === nota.ninoId)?.sala;
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
        sala={sala}
        onSala={onSala}
        cantidadPorSala={(s) => delPeriodo.filter((n) => salaDe(n) === s).length}
        periodo={periodo}
        onPeriodo={setPeriodo}
      />

      <TablaNotas notas={visibles} ahora={ahora} />
    </>
  );
}
