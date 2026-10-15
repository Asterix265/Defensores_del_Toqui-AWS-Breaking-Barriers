import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import type { SvgIconComponent } from '@mui/icons-material';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import EventNoteRounded from '@mui/icons-material/EventNoteRounded';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
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
        minWidth: 64,
        minHeight: 56,
        px: 0.5,
        py: 0.5,
        borderRadius: '12px',
        flexDirection: 'column',
        gap: 0.25,
        fontSize: 13,
        fontWeight: 700,
        color: activo ? 'primary.main' : 'text.secondary',
      }}
    >
      <Actual sx={{ fontSize: 30 }} />
      {etiqueta}
    </ButtonBase>
  );
}

/**
 * Barra inferior: Inicio · Mi sala · botón rojo central «Grabar» · Mis notas.
 * Grabar va centrado (a la altura del pulgar) y abre siempre el registro general: no recibe
 * al niño o niña de la pantalla en curso, para que una nota rápida no quede a nombre de otro.
 */
export function BarraInferior({
  activa,
  onInicio,
  onSala,
  onGrabar,
  onNotas,
}: {
  activa: 'inicio' | 'sala' | 'notas';
  onInicio: () => void;
  onSala: () => void;
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
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'end',
        px: 1,
        pt: 1,
        pb: 'calc(14px + env(safe-area-inset-bottom))',
        bgcolor: '#fff',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-evenly' }}>
        <ItemBarra
          etiqueta="Inicio"
          activo={activa === 'inicio'}
          Icono={HomeRounded}
          IconoInactivo={HomeOutlined}
          onClick={onInicio}
        />
        <ItemBarra
          etiqueta="Mi sala"
          activo={activa === 'sala'}
          Icono={GroupsRounded}
          IconoInactivo={GroupsOutlined}
          onClick={onSala}
        />
      </Box>
      <ButtonBase
        onClick={onGrabar}
        sx={{
          mt: '-34px',
          mx: 1,
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
      <Box sx={{ display: 'flex', justifyContent: 'space-evenly' }}>
        <ItemBarra
          etiqueta="Mis notas"
          activo={activa === 'notas'}
          Icono={EventNoteRounded}
          IconoInactivo={EventNoteOutlined}
          onClick={onNotas}
        />
      </Box>
    </Box>
  );
}
