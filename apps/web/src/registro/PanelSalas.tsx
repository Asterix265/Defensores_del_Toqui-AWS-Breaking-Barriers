import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddRounded from '@mui/icons-material/AddRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import type { Manifestacion, NivelRuta } from './api';
import type { Nino, Nota } from './datos';
import { NuevaNotaEscritorio } from './NuevaNotaEscritorio';
import { CabeceraPanel, type Seccion } from './panel/CabeceraPanel';
import { FichaEscritorio } from './panel/FichaEscritorio';
import { NotasSalas } from './panel/NotasSalas';
import { SalaEscritorio } from './panel/SalaEscritorio';

/**
 * Vista de escritorio con las pestañas del celular: «Mi sala» (niños y niñas y su ficha) y
 * «Mis notas» (diseño 1e: notas de las salas y reporte). La sala elegida se comparte entre
 * ambas pestañas. «Nueva nota» solo viene con niño o niña cuando se abre desde su ficha.
 */
export function PanelSalas({
  ninos,
  salas,
  catalogo,
  notas,
  ahora,
  nombre,
  onGuardar,
}: {
  ninos: Nino[];
  salas: string[];
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  notas: Nota[];
  ahora: Date;
  nombre: string;
  onGuardar: (nota: Nota) => void;
}) {
  const [seccion, setSeccion] = useState<Seccion>('notas');
  const [sala, setSala] = useState<string | null>(null);
  const [ninoAbierto, setNinoAbierto] = useState<string | null>(null);
  const [nueva, setNueva] = useState<{ ninoId?: string } | null>(null);

  const limite = desde(periodo, ahora);
  const delPeriodo = notas
    .filter((n) => !limite || n.creada >= limite)
    .sort((a, b) => b.creada.getTime() - a.creada.getTime());
  const salaDe = (nota: Nota) => nota.nino.sala;
  const visibles = sala ? delPeriodo.filter((n) => salaDe(n) === sala) : delPeriodo;

  const descargar = () => {
    const fecha = ahora.toISOString().slice(0, 10);
    descargarCsv(`notas-salas-${fecha}.csv`, notasACsv(visibles));
  const cambiarSeccion = (s: Seccion) => {
    setSeccion(s);
    setNinoAbierto(null);
  };
  const nuevaGeneral = () => setNueva({});
  const ficha = seccion === 'sala' ? NINOS.find((n) => n.id === ninoAbierto) : undefined;

  let contenido;
  if (seccion === 'notas') {
    contenido = (
      <NotasSalas
        notas={notas}
        ahora={ahora}
        sala={sala}
        onSala={setSala}
        onNuevaNota={nuevaGeneral}
      />
    );
  } else if (ficha) {
    contenido = (
      <FichaEscritorio
        nino={ficha}
        notas={notas}
        ahora={ahora}
        onVolver={() => setNinoAbierto(null)}
        onNuevaNota={() => setNueva({ ninoId: ficha.id })}
      />
    );
  } else {
    contenido = (
      <SalaEscritorio
        notas={notas}
        ahora={ahora}
        sala={sala}
        onSala={setSala}
        onAbrir={setNinoAbierto}
        onNuevaNota={nuevaGeneral}
      />
    );
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <CabeceraPanel nombre={nombre} seccion={seccion} onSeccion={cambiarSeccion} />
      <Box component="main" sx={{ maxWidth: 1280, mx: 'auto', px: 5, pt: 4, pb: 5 }}>
        {contenido}
      </Box>
      {nueva && (
        <NuevaNotaEscritorio
          ninoId={nueva.ninoId}
          semilla={notas.length}
          educadora={nombre}
          onCerrar={() => setNueva(null)}
          onGuardar={(nota) => {
            setNueva(null);
            onGuardar(nota);
          }}
        />
      )}
    </Box>
  );
}
