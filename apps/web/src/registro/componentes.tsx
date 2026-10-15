import type { ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { SvgIconComponent } from '@mui/icons-material';
import ChatBubbleRounded from '@mui/icons-material/ChatBubbleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DirectionsRunRounded from '@mui/icons-material/DirectionsRunRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import EventNoteRounded from '@mui/icons-material/EventNoteRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import HomeRounded from '@mui/icons-material/HomeRounded';
import LightbulbRounded from '@mui/icons-material/LightbulbRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import PanToolRounded from '@mui/icons-material/PanToolRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import { COLOR_DOMINIO, ETIQUETA_DOMINIO, type Dominio, type Formato, type Nino } from './datos';
import { colores } from './tema';

export const ICONO_FORMATO: Record<Formato, SvgIconComponent> = {
  audio: MicRounded,
  foto: PhotoCameraRounded,
  texto: EditNoteRounded,
};

const ICONO_DOMINIO: Record<Dominio, SvgIconComponent> = {
  cognitivo: LightbulbRounded,
  lenguaje_comunicacion: ChatBubbleRounded,
  motor_fino: PanToolRounded,
  motor_grueso: DirectionsRunRounded,
  socioemocional: FavoriteRounded,
};

export function formatoHora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function claveDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/** «Hoy», «Ayer» o la fecha larga («lunes 12 de octubre»). */
export function etiquetaDia(fecha: Date, ahora: Date): string {
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (claveDia(fecha) === claveDia(ahora)) return 'Hoy';
  if (claveDia(fecha) === claveDia(ayer)) return 'Ayer';
  return fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** «Hoy 10:14», «Ayer 16:30» o «12 oct 09:15». */
export function formatoCuando(fecha: Date, ahora: Date): string {
  const dia = etiquetaDia(fecha, ahora);
  const corto =
    dia === 'Hoy' || dia === 'Ayer'
      ? dia
      : fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  return `${corto} ${formatoHora(fecha)}`;
}

export function formatoDuracion(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/** Contenedor de cada pantalla: ocupa el alto disponible y deja el contenido en columna. */
export function Pantalla({ children, oscura = false }: { children: ReactNode; oscura?: boolean }) {
  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        minHeight: 0,
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
  onCancelar,
}: {
  titulo: string;
  subtitulo?: string;
  onCancelar: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1 }}>
        <Encabezado titulo={titulo} subtitulo={subtitulo} />
      </Box>
      <IconButton aria-label="Cancelar nota" onClick={onCancelar} sx={{ mt: 2.5, mr: 1 }}>
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
  area: Dominio;
  seleccionada?: boolean;
  compacto?: boolean;
  onClick?: () => void;
}) {
  const Icono = ICONO_DOMINIO[area];
  const { fondo, tinta } = COLOR_DOMINIO[area];
  return (
    <Chip
      label={ETIQUETA_DOMINIO[area]}
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

function ItemBarra({
  etiqueta,
  activo,
  Icono,
  IconoInactivo,
  onClick,
}: {
  etiqueta: string;
  activo: boolean;
  Icono: SvgIconComponent;
  IconoInactivo: SvgIconComponent;
  onClick: () => void;
}) {
  const Actual = activo ? Icono : IconoInactivo;
  return (
    <ButtonBase
      onClick={onClick}
      aria-current={activo ? 'page' : undefined}
      sx={{
        width: 84,
        py: 0.5,
        borderRadius: '12px',
        flexDirection: 'column',
        gap: 0.25,
        fontSize: 14,
        fontWeight: 700,
        color: activo ? 'primary.main' : 'text.secondary',
      }}
    >
      <Actual sx={{ fontSize: 30 }} />
      {etiqueta}
    </ButtonBase>
  );
}

/** Barra inferior: Inicio · botón rojo central «Grabar» · Mis notas. */
export function BarraInferior({
  activa,
  onInicio,
  onGrabar,
  onNotas,
}: {
  activa: 'inicio' | 'notas';
  onInicio: () => void;
  onGrabar: () => void;
  onNotas: () => void;
}) {
  return (
    <Box
      component="nav"
      aria-label="Navegación principal"
      sx={{
        position: 'sticky',
        bottom: 0,
        mt: 'auto',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        px: 1.5,
        pt: 1,
        pb: 'calc(14px + env(safe-area-inset-bottom))',
        bgcolor: '#fff',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <ItemBarra
        etiqueta="Inicio"
        activo={activa === 'inicio'}
        Icono={HomeRounded}
        IconoInactivo={HomeOutlined}
        onClick={onInicio}
      />
      <ButtonBase
        onClick={onGrabar}
        sx={{
          mt: '-34px',
          borderRadius: '16px',
          flexDirection: 'column',
          gap: 0.5,
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 8px 24px -4px rgba(214,40,57,.35)',
          }}
        >
          <MicRounded sx={{ fontSize: 38 }} />
        </Box>
        Grabar
      </ButtonBase>
      <ItemBarra
        etiqueta="Mis notas"
        activo={activa === 'notas'}
        Icono={EventNoteRounded}
        IconoInactivo={EventNoteOutlined}
        onClick={onNotas}
      />
    </Box>
  );
}
