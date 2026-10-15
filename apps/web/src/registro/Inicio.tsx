import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import { AvisoVerde, Encabezado, Pantalla } from './componentes';
import type { Formato } from './datos';
import { colores } from './tema';

const DETALLE_CELULAR: Record<Formato, string> = {
  audio: 'Habla y nosotros escribimos',
  foto: 'De tu post-it o nota',
  texto: 'Con el teclado',
};

/** Inicio «acción primero» (diseño 1b): tres botones grandes para elegir cómo registrar. */
export function Inicio({
  nombre,
  notasHoy,
  onElegir,
}: {
  nombre: string;
  notasHoy: number;
  onElegir: (formato: Formato) => void;
}) {
  return (
    <Pantalla>
      <Encabezado titulo={`Hola, ${nombre}`} subtitulo="¿Qué quieres registrar?" />
      <BotonesFormato detalles={DETALLE_CELULAR} onElegir={onElegir} />
      {notasHoy > 0 && (
        <Box sx={{ px: 2, pt: 2, pb: 2 }}>
          <AvisoVerde icono={<CheckCircleRounded />}>
            Hoy guardaste {notasHoy} {notasHoy === 1 ? 'nota' : 'notas'}
          </AvisoVerde>
        </Box>
      )}
    </Pantalla>
  );
}

/** Los tres botones grandes (Audio, Foto, Escribir); el detalle cambia entre celular y PC. */
export function BotonesFormato({
  detalles,
  onElegir,
}: {
  detalles: Record<Formato, string>;
  onElegir: (formato: Formato) => void;
}) {
  return (
    <Stack sx={{ px: 2, pt: 2.25, gap: 1.5 }}>
      <BotonFormato
        titulo="Audio"
        detalle={detalles.audio}
        icono={<MicRounded sx={{ fontSize: 40 }} />}
        fondo={colores.rojo}
        fondoIcono="rgba(255,255,255,.18)"
        claro
        onClick={() => onElegir('audio')}
      />
      <BotonFormato
        titulo="Foto"
        detalle={detalles.foto}
        icono={<PhotoCameraRounded sx={{ fontSize: 40, color: colores.texto }} />}
        fondo={colores.amarilloSuave}
        fondoIcono={colores.amarillo}
        borde={colores.amarillo}
        onClick={() => onElegir('foto')}
      />
      <BotonFormato
        titulo="Escribir"
        detalle={detalles.texto}
        icono={<EditNoteRounded sx={{ fontSize: 40, color: colores.textoSuave }} />}
        fondo="#fff"
        fondoIcono={colores.cremaRosa}
        borde={colores.borde}
        onClick={() => onElegir('texto')}
      />
    </Stack>
  );
}

function BotonFormato({
  titulo,
  detalle,
  icono,
  fondo,
  fondoIcono,
  borde,
  claro = false,
  onClick,
}: {
  titulo: string;
  detalle: string;
  icono: ReactNode;
  fondo: string;
  fondoIcono: string;
  borde?: string;
  claro?: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        height: 120,
        px: 2.75,
        gap: 2.25,
        justifyContent: 'flex-start',
        textAlign: 'left',
        borderRadius: '24px',
        bgcolor: fondo,
        color: claro ? '#fff' : 'text.primary',
        border: borde ? `1px solid ${borde}` : 'none',
        boxShadow: claro ? '0 8px 24px -4px rgba(214,40,57,.3)' : 'none',
      }}
    >
      <Box
        sx={{
          width: 68,
          height: 68,
          flexShrink: 0,
          borderRadius: '50%',
          bgcolor: fondoIcono,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {icono}
      </Box>
      <Stack sx={{ gap: 0.25 }}>
        <Box component="span" sx={{ fontSize: 24, fontWeight: 800 }}>
          {titulo}
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 16, fontWeight: 600, color: claro ? '#fff' : 'text.secondary' }}
        >
          {detalle}
        </Box>
      </Stack>
    </ButtonBase>
  );
}
