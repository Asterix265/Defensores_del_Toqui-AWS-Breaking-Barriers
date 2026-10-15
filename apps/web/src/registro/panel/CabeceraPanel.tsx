import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function iniciales(nombre: string): string {
  return nombre.slice(0, 2).toUpperCase();
}

/** Barra superior del panel: institución, jardín y educadora con sesión. */
export function CabeceraPanel({ nombre }: { nombre: string }) {
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
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar sx={{ bgcolor: 'primary.main', fontSize: 14 }}>{iniciales(nombre)}</Avatar>
        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{nombre}</Typography>
      </Box>
    </Box>
  );
}
