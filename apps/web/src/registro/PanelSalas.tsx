import { useState } from 'react';
import Box from '@mui/material/Box';
import type { Manifestacion, NivelRuta } from './api';
import type { Nino } from './datos';
import { useVistaConHistorial } from './historial';
import { NuevaNotaEscritorio } from './NuevaNotaEscritorio';
import { DetalleNota } from './panel/DetalleNota';
import { CabeceraPanel, type Seccion } from './panel/CabeceraPanel';
import { FichaEscritorio } from './panel/FichaEscritorio';
import { NotasSalas } from './panel/NotasSalas';
import { SalaEscritorio } from './panel/SalaEscritorio';
import { useSalidaNota } from './salida';

/**
 * Lo que muestra el panel, guardado en el historial: Atrás cierra primero el diálogo y después
 * la ficha. `nota` es el diálogo de nota nueva (con dueño si viene de la ficha) o de revisión.
 */
interface VistaPanel {
  seccion: Seccion;
  ninoId: string | null;
  nota: { ninoId?: string; capturaId?: string } | null;
  /** Nota confirmada abierta en detalle desde la tabla. */
  detalle: string | null;
}

const INICIAL: VistaPanel = { seccion: 'notas', ninoId: null, nota: null, detalle: null };

/**
 * Vista de escritorio con las pestañas del celular: «Mi sala» (niños y niñas y su ficha) y
 * «Mis notas» (diseño 1e: notas de las salas y reporte). La sala elegida se comparte entre
 * ambas pestañas. «Nueva nota» solo viene con niño o niña cuando se abre desde su ficha.
 */
export function PanelSalas({
  ninos,
  salas,
  salaPropia,
  catalogo,
  ahora,
  nombre,
  onGuardada,
  onSalir,
}: {
  ninos: Nino[];
  salas: string[];
  salaPropia: string;
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  ahora: Date;
  nombre: string;
  onGuardada: (nino: Nino) => void;
  /** Pide cerrar sesión; la confirmación la muestra quien llama. */
  onSalir?: () => void;
}) {
  const [sala, setSala] = useState<string | null>(null);
  const salida = useSalidaNota();
  const { vista, ir, volver } = useVistaConHistorial<VistaPanel>({
    clave: 'panel',
    inicial: INICIAL,
    // Adelante no rearma una nota a medio hacer; una revisión sí, porque está en la API.
    restaurable: (v) => !v.nota || v.nota.capturaId !== undefined,
    interceptar: () => {
      if (!salida.hayEnCurso()) return false;
      salida.pedir(() => volver());
      return true;
    },
  });
  const { seccion, ninoId: ninoAbierto, nota } = vista;
  const base = { ...vista, nota: null, detalle: null };

  const cambiarSeccion = (s: Seccion) => ir({ ...INICIAL, seccion: s });
  const abrirNota = (n: VistaPanel['nota']) => ir({ ...base, nota: n });
  const nuevaGeneral = () => abrirNota({});
  const ficha = seccion === 'sala' ? ninos.find((n) => n.id === ninoAbierto) : undefined;

  let contenido;
  if (seccion === 'notas') {
    contenido = (
      <NotasSalas
        ninos={ninos}
        salas={salas}
        ahora={ahora}
        sala={sala}
        onSala={setSala}
        onNuevaNota={nuevaGeneral}
        onRevisar={(capturaId) => abrirNota({ capturaId })}
        onAbrirNota={(id) => ir({ ...base, detalle: id })}
      />
    );
  } else if (ficha) {
    contenido = (
      <FichaEscritorio
        nino={ficha}
        salaPropia={salaPropia}
        ahora={ahora}
        onVolver={() => volver({ ...INICIAL, seccion: 'sala' })}
        onNuevaNota={() => abrirNota({ ninoId: ficha.id })}
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
        onAbrir={(id) => ir({ ...INICIAL, seccion: 'sala', ninoId: id })}
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
      {nota && (
        <NuevaNotaEscritorio
          // Otra nota (o la misma reabierta) parte de cero.
          key={JSON.stringify(nota)}
          ninos={ninos}
          catalogo={catalogo}
          ninoId={nota.ninoId}
          capturaId={nota.capturaId}
          onCerrar={() => salida.pedir(() => volver())}
          onTerminada={() => volver()}
          onEnCurso={salida.marcar}
          onGuardada={(nino) => {
            volver();
            onGuardada(nino);
          }}
        />
      )}
      {vista.detalle && (
        <DetalleNota capturaId={vista.detalle} ninos={ninos} onCerrar={() => volver()} />
      )}
      {salida.dialogo}
    </Box>
  );
}
