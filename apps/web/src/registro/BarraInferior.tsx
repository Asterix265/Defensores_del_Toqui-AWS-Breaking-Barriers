import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import type { SvgIconComponent } from '@mui/icons-material';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import EventNoteRounded from '@mui/icons-material/EventNoteRounded';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import HomeRounded from '@mui/icons-material/HomeRounded';
import MicRounded from '@mui/icons-material/MicRounded';

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
