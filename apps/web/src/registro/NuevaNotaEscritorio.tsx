import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { CabeceraConCerrar, Pantalla } from './componentes';
import type { Formato, Nota } from './datos';
import { BotonesFormato } from './Inicio';
import { NuevaNota } from './NuevaNota';

const DETALLE_PC: Record<Formato, string> = {
  audio: 'Sube un audio o graba',
  foto: 'Sube la foto de tu post-it',
  texto: 'Con el teclado',
};

/** «Nueva nota» en PC: el mismo flujo 1b dentro de un diálogo, con carga de archivos. */
export function NuevaNotaEscritorio({
  semilla,
  educadora,
  onGuardar,
  onCerrar,
}: {
  semilla: number;
  educadora: string;
  onGuardar: (nota: Nota) => void;
  onCerrar: () => void;
}) {
  const [formato, setFormato] = useState<Formato | null>(null);

  return (
    <Dialog
      open
      onClose={onCerrar}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          'aria-label': 'Nueva nota',
          sx: {
            height: 'min(780px, calc(100dvh - 64px))',
            borderRadius: '24px',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}
    >
      {formato ? (
        <NuevaNota
          formato={formato}
          semilla={semilla}
          educadora={educadora}
          escritorio
          onGuardar={onGuardar}
          onCancelar={onCerrar}
        />
      ) : (
        <Pantalla>
          <CabeceraConCerrar
            titulo="Nueva nota"
            subtitulo="¿Qué quieres registrar?"
            onCancelar={onCerrar}
          />
          <BotonesFormato detalles={DETALLE_PC} onElegir={setFormato} />
        </Pantalla>
      )}
    </Dialog>
  );
}
