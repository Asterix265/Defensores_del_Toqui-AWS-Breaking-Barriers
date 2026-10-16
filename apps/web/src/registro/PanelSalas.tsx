import { useState } from 'react';
import Box from '@mui/material/Box';
import type { Manifestacion, NivelRuta } from './api';
import type { Nino } from './datos';
import { NuevaNotaEscritorio } from './NuevaNotaEscritorio';
import { CabeceraPanel, type Seccion } from './panel/CabeceraPanel';
import { FichaEscritorio } from './panel/FichaEscritorio';
import { NotasSalas } from './panel/NotasSalas';
import { SalaEscritorio } from './panel/SalaEscritorio';
import { VistaJardin } from './panel/VistaJardin';

/**
 * Vista de escritorio con las pestañas del celular: «Mi sala» (niños y niñas y su ficha) y
 * «Mis notas» (diseño 1e: notas de las salas y reporte), más «Vista general» con el estado de
 * todas las salas (con la que parte la directora). La sala elegida se comparte entre las
 * pestañas. «Nueva nota» solo viene con niño o niña cuando se abre desde su ficha.
 */
export function PanelSalas({
  ninos,
  salas,
  salaPropia,
  catalogo,
  ahora,
  nombre,
  directora = false,
  onGuardada,
  onSalir,
}: {
  ninos: Nino[];
  salas: string[];
  salaPropia: string;
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  ahora: Date;
  nombre: string;
  /** La directora parte en «Vista general». */
  directora?: boolean;
  onGuardada: (nino: Nino) => void;
  /** Pide cerrar sesión; la confirmación la muestra quien llama. */
  onSalir?: () => void;
}) {
  const [seccion, setSeccion] = useState<Seccion>(directora ? 'jardin' : 'notas');
  const [sala, setSala] = useState<string | null>(null);
  const [ninoAbierto, setNinoAbierto] = useState<string | null>(null);
  const [nueva, setNueva] = useState<{ ninoId?: string } | null>(null);

  const cambiarSeccion = (s: Seccion) => {
    setSeccion(s);
    setNinoAbierto(null);
  };
  const nuevaGeneral = () => setNueva({});
  const ficha = seccion === 'sala' ? ninos.find((n) => n.id === ninoAbierto) : undefined;

  let contenido;
  if (seccion === 'jardin') {
    contenido = (
      <VistaJardin
        ninos={ninos}
        salas={salas}
        ahora={ahora}
        onAbrirSala={(s) => {
          setSala(s);
          cambiarSeccion('sala');
        }}
      />
    );
  } else if (seccion === 'notas') {
    contenido = (
      <NotasSalas
        ninos={ninos}
        salas={salas}
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
        catalogo={catalogo}
        salaPropia={salaPropia}
        ahora={ahora}
        onVolver={() => setNinoAbierto(null)}
        onNuevaNota={() => setNueva({ ninoId: ficha.id })}
      />
    );
  } else {
    contenido = (
      <SalaEscritorio
        ninos={ninos}
        salas={salas}
        salaPropia={salaPropia}
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
      <CabeceraPanel
        nombre={nombre}
        seccion={seccion}
        onSeccion={cambiarSeccion}
        onSalir={onSalir}
      />
      <Box component="main" sx={{ maxWidth: 1280, mx: 'auto', px: 5, pt: 4, pb: 5 }}>
        {contenido}
      </Box>
      {nueva && (
        <NuevaNotaEscritorio
          ninos={ninos}
          catalogo={catalogo}
          ninoId={nueva.ninoId}
          onCerrar={() => setNueva(null)}
          onGuardada={(nino) => {
            setNueva(null);
            onGuardada(nino);
          }}
        />
      )}
    </Box>
  );
}
