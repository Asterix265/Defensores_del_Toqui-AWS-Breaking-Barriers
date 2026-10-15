import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddRounded from '@mui/icons-material/AddRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import type { Manifestacion, NivelRuta } from './api';
import type { Nino } from './datos';
import { NuevaNotaEscritorio } from './NuevaNotaEscritorio';
import { CabeceraPanel } from './panel/CabeceraPanel';
import { FiltrosPanel } from './panel/FiltrosPanel';
import { ETIQUETA_PERIODO, desde, type Periodo } from './panel/periodo';
import { TablaNotas } from './panel/TablaNotas';
import { useNotas, type NotaGuardada } from './registrar';
import { descargarCsv, notasACsv } from './reporte';

/**
 * Vista de escritorio (diseño 1e): notas de todas las salas, descarga del reporte y
 * «Nueva nota» para cargar notas desde el PC.
 */
export function PanelSalas({
  ninos,
  salas,
  catalogo,
  ahora,
  nombre,
  onGuardada,
}: {
  ninos: Nino[];
  salas: string[];
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  ahora: Date;
  nombre: string;
  onGuardada: (nino: Nino) => void;
}) {
  const [sala, setSala] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('7dias');

  // Solo las notas confirmadas: son las observaciones que quedan en el registro del jardín.
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
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <CabeceraPanel nombre={nombre} />

      <Box component="main" sx={{ maxWidth: 1280, mx: 'auto', px: 5, pt: 4, pb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
          <Box>
            <Typography variant="h1" sx={{ fontSize: 32, lineHeight: '40px' }}>
              Notas de las salas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {ETIQUETA_PERIODO[periodo]} · {visibles.length}{' '}
              {visibles.length === 1 ? 'nota' : 'notas'}
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadRounded />}
              disabled={visibles.length === 0}
              onClick={descargar}
              sx={{ minHeight: 52, px: 3, fontSize: 17, bgcolor: '#fff' }}
            >
              Descargar reporte
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => setCargando(true)}
              sx={{
                minHeight: 52,
                px: 3,
                fontSize: 17,
                boxShadow: '0 8px 24px -4px rgba(214,40,57,.3)',
              }}
            >
              Nueva nota
            </Button>
          </Box>
        </Box>

        <FiltrosPanel
          salas={salas}
          sala={sala}
          onSala={setSala}
          cantidadPorSala={(s) => delPeriodo.filter((n) => salaDe(n) === s).length}
          periodo={periodo}
          onPeriodo={setPeriodo}
        />

        {consulta.isError && (
          <Alert severity="error" sx={{ mt: 2.5, borderRadius: '14px' }}>
            No se pudieron cargar las notas. Revisa que la API esté levantada.
          </Alert>
        )}
        <TablaNotas notas={visibles} ahora={ahora} />
      </Box>
      {cargando && (
        <NuevaNotaEscritorio
          ninos={ninos}
          catalogo={catalogo}
          onCerrar={() => setCargando(false)}
          onGuardada={(nino) => {
            setCargando(false);
            onGuardada(nino);
          }}
        />
      )}
    </Box>
  );
}
