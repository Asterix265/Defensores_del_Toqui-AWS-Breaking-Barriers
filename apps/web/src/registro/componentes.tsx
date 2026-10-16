import type { ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import CalculateRounded from '@mui/icons-material/CalculateRounded';
import ChatBubbleRounded from '@mui/icons-material/ChatBubbleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DirectionsRunRounded from '@mui/icons-material/DirectionsRunRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import FaceRounded from '@mui/icons-material/FaceRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import ParkRounded from '@mui/icons-material/ParkRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import { COLOR_NUCLEO, ETIQUETA_NUCLEO, type Nucleo, type Formato, type Nino } from './datos';
import { colores } from './tema';

export const ICONO_FORMATO: Record<Formato, SvgIconComponent> = {
  audio: MicRounded,
  foto: PhotoCameraRounded,
  texto: EditNoteRounded,
};

export const ICONO_NUCLEO: Record<Nucleo, SvgIconComponent> = {
  IA: FaceRounded,
  CC: GroupsRounded,
  CM: DirectionsRunRounded,
  LV: ChatBubbleRounded,
  LA: PaletteRounded,
  EN: ParkRounded,
  ES: PublicRounded,
  PM: CalculateRounded,
};

/**
 * Contenedor de cada pantalla: ocupa al menos el alto disponible y deja el contenido en columna.
 * No se encoge: si no cabe, desplaza quien la contiene (la página en el celular, el diálogo en PC).
 */
export function Pantalla({ children, oscura = false }: { children: ReactNode; oscura?: boolean }) {
  return (
    <Box
      component="main"
      sx={{
        flex: '1 0 auto',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: oscura ? colores.camara : 'background.default',
        color: oscura ? '#fff' : 'text.primary',
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Acciones principales al pie de la pantalla («Listo», «Seguir con…», «Está bien»): quedan
 * pegadas abajo mientras el contenido se desplaza, en el celular y en el diálogo de PC.
 */
export function PieAcciones({ children }: { children: ReactNode }) {
  return (
    <Stack
      sx={{
        mt: 'auto',
        position: 'sticky',
        bottom: 0,
        zIndex: 1,
        px: 2,
        pt: 1.5,
        pb: 'calc(28px + env(safe-area-inset-bottom))',
        gap: 0.75,
        bgcolor: 'background.default',
        boxShadow: '0 -10px 16px -14px rgba(58,36,20,.35)',
      }}
    >
      {children}
    </Stack>
  );
}

export function Encabezado({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <Stack sx={{ px: 2.5, pt: 3, gap: 0.5 }}>
      <Typography variant="h1">{titulo}</Typography>
      {subtitulo && (
        <Typography variant="body2" color="text.secondary">
          {subtitulo}
        </Typography>
      )}
    </Stack>
  );
}

/** Encabezado con botón para cancelar la nota en curso. */
export function CabeceraConCerrar({
  titulo,
  subtitulo,
  etiquetaCerrar = 'Cancelar nota',
  onCancelar,
}: {
  titulo: string;
  subtitulo?: string;
  etiquetaCerrar?: string;
  onCancelar: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1 }}>
        <Encabezado titulo={titulo} subtitulo={subtitulo} />
      </Box>
      <IconButton aria-label={etiquetaCerrar} onClick={onCancelar} sx={{ mt: 2.5, mr: 1 }}>
        <CloseRounded sx={{ fontSize: 28, color: 'text.secondary' }} />
      </IconButton>
    </Box>
  );
}

export function NinoAvatar({ nino, tamano = 40 }: { nino: Nino; tamano?: number }) {
  return (
    <Avatar
      aria-hidden
      sx={{
        width: tamano,
        height: tamano,
        bgcolor: nino.fondo,
        color: nino.tinta,
        fontSize: Math.round(tamano * 0.32),
      }}
    >
      {nino.iniciales}
    </Avatar>
  );
}

export function ChipArea({
  area,
  seleccionada = true,
  compacto = false,
  onClick,
}: {
  area: Nucleo;
  seleccionada?: boolean;
  compacto?: boolean;
  onClick?: () => void;
}) {
  const Icono = ICONO_NUCLEO[area];
  const { fondo, tinta } = COLOR_NUCLEO[area];
  return (
    <Chip
      label={ETIQUETA_NUCLEO[area]}
      icon={compacto ? undefined : <Icono />}
      onClick={onClick}
      aria-pressed={onClick ? seleccionada : undefined}
      sx={{
        bgcolor: seleccionada ? fondo : '#fff',
        color: seleccionada ? tinta : 'text.secondary',
        border: 1,
        borderColor: seleccionada ? fondo : 'divider',
        ...(compacto && { height: 32, fontSize: 14 }),
        '& .MuiChip-icon': { color: 'inherit', fontSize: 20 },
        '&.MuiChip-clickable:hover': { bgcolor: seleccionada ? fondo : colores.crema },
      }}
    />
  );
}

/** Aviso verde de confirmación («Hoy guardaste 4 notas», «Foto lista»). */
export function AvisoVerde({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: 52,
        px: 2,
        py: 1,
        borderRadius: '16px',
        bgcolor: colores.verdeSuave,
        color: colores.verdeOscuro,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        fontWeight: 700,
        fontSize: 16,
      }}
    >
      {icono}
      {children}
    </Box>
  );
}
