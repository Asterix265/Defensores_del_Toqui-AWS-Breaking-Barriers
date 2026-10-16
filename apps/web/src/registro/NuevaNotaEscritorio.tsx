import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { CabeceraConCerrar, Pantalla } from './componentes';
import type { Manifestacion, NivelRuta } from './api';
import type { Formato, Nino } from './datos';
import { BotonesFormato } from './Inicio';
import { NuevaNota, RevisarCaptura } from './NuevaNota';
import type { EnCurso } from './salida';

const DETALLE_PC: Record<Formato, string> = {
  audio: 'Sube un audio o graba',
  foto: 'Sube la foto de tu post-it',
  texto: 'Con el teclado',
};

/**
 * «Nueva nota» en PC: el mismo flujo 1b dentro de un diálogo, con carga de archivos.
 * Con `ninoId` (desde la ficha) la nota ya tiene dueño y se salta la elección; con `capturaId`
 * abre la revisión de una nota «Sin revisar». El diálogo desplaza su contenido y las acciones
 * quedan fijas abajo.
 */
export function NuevaNotaEscritorio({
  ninos,
  catalogo,
  ninoId,
  capturaId,
  onGuardada,
  onCerrar,
  onTerminada,
  onEnCurso,
}: {
  ninos: Nino[];
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  ninoId?: string;
  capturaId?: string;
  onGuardada: (nino: Nino) => void;
  /** Pide cerrar (×, Cancelar, clic fuera o Escape); quien llama confirma si hay algo en curso. */
  onCerrar: () => void;
  /** Cierra sin confirmar: la nota se borró. */
  onTerminada: () => void;
  onEnCurso: (enCurso: EnCurso) => void;
}) {
  const [formato, setFormato] = useState<Formato | null>(null);

  let contenido;
  if (capturaId) {
    contenido = (
      <RevisarCaptura
        capturaId={capturaId}
        ninos={ninos}
        catalogo={catalogo}
        onGuardada={onGuardada}
        onCancelar={onCerrar}
        onBorrada={onTerminada}
        onEnCurso={onEnCurso}
      />
    );
  } else if (formato) {
    contenido = (
      <NuevaNota
        formato={formato}
        escritorio
        ninos={ninos}
        ninoFijo={ninos.find((n) => n.id === ninoId)}
        catalogo={catalogo}
        onGuardada={onGuardada}
        onCancelar={onCerrar}
        onBorrada={onTerminada}
        onEnCurso={onEnCurso}
      />
    );
  } else {
    contenido = (
      <Pantalla>
        <CabeceraConCerrar
          titulo="Nueva nota"
          subtitulo="¿Qué quieres registrar?"
          onCancelar={onCerrar}
        />
        <BotonesFormato detalles={DETALLE_PC} onElegir={setFormato} />
      </Pantalla>
    );
  }

  return (
    <Dialog
      open
      onClose={onCerrar}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          'aria-label': capturaId ? 'Revisar nota' : 'Nueva nota',
          sx: {
            height: 'min(780px, calc(100dvh - 64px))',
            borderRadius: '24px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            // El contenido se desplaza dentro del diálogo; `PieAcciones` queda pegado abajo.
            overflowY: 'auto',
          },
        },
      }}
    >
      {contenido}
    </Dialog>
  );
}
