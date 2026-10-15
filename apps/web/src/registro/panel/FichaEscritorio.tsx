import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import { etiquetaSala } from '../api';
import { NinoAvatar } from '../componentes';
import type { Nino, Nota } from '../datos';
import { AreasNino, UltimasNotas } from '../FichaNino';
import { BotonNuevaNota } from './TituloVista';

/**
 * Ficha del niño o niña en escritorio: el mismo contenido del celular (áreas en 30 días y
 * últimas notas) en dos columnas. No muestra niveles ni comparaciones con la edad.
 */
export function FichaEscritorio({
  nino,
  salaPropia,
  notas,
  ahora,
  onVolver,
  onNuevaNota,
}: {
  nino: Nino;
  salaPropia: string;
  notas: Nota[];
  ahora: Date;
  onVolver: () => void;
  /** Abre «Nueva nota» ya asociada a este niño o niña. */
  onNuevaNota: () => void;
}) {
  return (
    <>
      <ButtonBase
        onClick={onVolver}
        aria-label="Volver a Mi sala"
        sx={{
          minHeight: 44,
          ml: -1,
          pr: 1.5,
          borderRadius: '12px',
          fontSize: 16,
          fontWeight: 700,
          color: 'text.secondary',
        }}
      >
        <ChevronLeftRounded />
        Mi sala
      </ButtonBase>

      <Box sx={{ pt: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <NinoAvatar nino={nino} tamano={64} />
        <Box>
          <Typography variant="h1" sx={{ fontSize: 32, lineHeight: '40px' }}>
            {nino.nombre}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {etiquetaSala(nino.sala)}
            {nino.sala === salaPropia && ' · Tu sala'}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <BotonNuevaNota onClick={onNuevaNota} etiqueta={`Nueva nota para ${nino.nombre}`} />
        </Box>
      </Box>

      <Box
        sx={{
          pt: 3,
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 420px) minmax(0, 1fr)',
          alignItems: 'start',
          gap: 4,
        }}
      >
        <AreasNino nino={nino} notas={notas} ahora={ahora} />
        <UltimasNotas
          key={nino.id}
          nino={nino}
          notas={notas}
          ahora={ahora}
          sinNotas={`Usa «Nueva nota para ${nino.nombre}» para registrar la primera.`}
        />
      </Box>
    </>
  );
}
