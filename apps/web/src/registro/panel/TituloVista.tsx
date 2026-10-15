import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddRounded from '@mui/icons-material/AddRounded';
import type { ReactNode } from 'react';

/** Botón rojo «Nueva nota» de las vistas de escritorio. */
export function BotonNuevaNota({
  onClick,
  etiqueta = 'Nueva nota',
}: {
  onClick: () => void;
  etiqueta?: string;
}) {
  return (
    <Button
      variant="contained"
      startIcon={<AddRounded />}
      onClick={onClick}
      sx={{
        minHeight: 52,
        px: 3,
        fontSize: 17,
        boxShadow: '0 8px 24px -4px rgba(214,40,57,.3)',
      }}
    >
      {etiqueta}
    </Button>
  );
}

/** Título grande de cada vista con su subtítulo y acciones a la derecha. */
export function TituloVista({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo: string;
  children?: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
      <Box>
        <Typography variant="h1" sx={{ fontSize: 32, lineHeight: '40px' }}>
          {titulo}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitulo}
        </Typography>
      </Box>
      <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>{children}</Box>
    </Box>
  );
}
