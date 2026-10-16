import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import EventNoteRounded from '@mui/icons-material/EventNoteRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';

export type Seccion = 'sala' | 'notas';

function iniciales(nombre: string): string {
  return nombre.slice(0, 2).toUpperCase();
}

/**
 * Barra superior del panel: institución y jardín, pestañas «Mi sala» · «Mis notas» (los mismos
 * destinos e íconos de la barra del celular) y educadora con sesión, cuyo menú permite salir.
 */
export function CabeceraPanel({
  nombre,
  seccion,
  onSeccion,
  onSalir,
}: {
  nombre: string;
  seccion: Seccion;
  onSeccion: (seccion: Seccion) => void;
  onSalir?: () => void;
}) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  return (
    <Box
      component="header"
      sx={{
        height: 64,
        px: 4,
        bgcolor: '#fff',
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
      <Typography sx={{ fontSize: 18, fontWeight: 800 }}>Fundación Integra</Typography>
      <Typography variant="body2" color="text.secondary">
        · Jardín Caracolitos
      </Typography>

      <Tabs
        value={seccion}
        aria-label="Secciones"
        sx={{ ml: 5, alignSelf: 'stretch', '& .MuiTabs-flexContainer': { height: '100%' } }}
      >
        <TabSeccion value="sala" etiqueta="Mi sala" Icono={GroupsRounded} onSeccion={onSeccion} />
        <TabSeccion
          value="notas"
          etiqueta="Mis notas"
          Icono={EventNoteRounded}
          onSeccion={onSeccion}
        />
      </Tabs>

      <ButtonBase
        aria-label={`Cuenta de ${nombre}`}
        aria-haspopup="menu"
        aria-expanded={ancla ? 'true' : undefined}
        disabled={!onSalir}
        onClick={(e) => setAncla(e.currentTarget)}
        sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.25, p: 1, borderRadius: 3 }}
      >
        <Avatar sx={{ bgcolor: 'primary.main', fontSize: 14 }}>{iniciales(nombre)}</Avatar>
        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{nombre}</Typography>
        {onSalir && <ExpandMoreRounded sx={{ color: 'text.secondary' }} />}
      </ButtonBase>
      {onSalir && (
        <Menu
          anchorEl={ancla}
          open={ancla !== null}
          onClose={() => setAncla(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => {
              setAncla(null);
              onSalir();
            }}
          >
            <ListItemIcon>
              <LogoutRounded />
            </ListItemIcon>
            Cerrar sesión
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
}

/** `value` (no `valor`): `Tabs` lo lee del hijo para marcar la pestaña activa. */
function TabSeccion({
  value,
  etiqueta,
  Icono,
  onSeccion,
  ...props
}: {
  value: Seccion;
  etiqueta: string;
  Icono: typeof GroupsRounded;
  onSeccion: (seccion: Seccion) => void;
}) {
  return (
    <Tab
      {...props}
      value={value}
      label={etiqueta}
      icon={<Icono />}
      iconPosition="start"
      // onClick y no onChange de Tabs: presionar la pestaña activa también avisa, así «Mi sala»
      // cierra una ficha abierta.
      onClick={() => onSeccion(value)}
      sx={{ minHeight: 64, px: 2.5, fontSize: 16, fontWeight: 700, textTransform: 'none' }}
    />
  );
}
