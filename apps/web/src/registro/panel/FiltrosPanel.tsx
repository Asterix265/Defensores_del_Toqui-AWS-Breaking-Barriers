import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import CalendarTodayRounded from '@mui/icons-material/CalendarTodayRounded';
import { etiquetaSala } from '../api';
import { colores } from '../tema';
import { ETIQUETA_PERIODO, type Periodo } from './periodo';

/** Chips de sala y selector de periodo de «Mis notas». */
export function FiltrosPanel({
  salas,
  sala,
  onSala,
  cantidadPorSala,
  periodo,
  onPeriodo,
}: {
  salas: string[];
  sala: string | null;
  onSala: (sala: string | null) => void;
  cantidadPorSala: (sala: string) => number;
  periodo: Periodo;
  onPeriodo: (periodo: Periodo) => void;
}) {
  return (
    <Box sx={{ pt: 3, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
      <ChipsSala salas={salas} sala={sala} onSala={onSala} cantidadPorSala={cantidadPorSala} />
      <Select
        value={periodo}
        onChange={(e) => onPeriodo(e.target.value as Periodo)}
        inputProps={{ 'aria-label': 'Periodo' }}
        renderValue={(valor) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayRounded sx={{ fontSize: 22, color: 'text.secondary' }} />
            {ETIQUETA_PERIODO[valor]}
          </Box>
        )}
        sx={{
          ml: 'auto',
          height: 44,
          bgcolor: '#fff',
          borderRadius: '12px',
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {(Object.keys(ETIQUETA_PERIODO) as Periodo[]).map((p) => (
          <MenuItem key={p} value={p}>
            {ETIQUETA_PERIODO[p]}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

/**
 * Chips de sala («Todas las salas» + una por sala con su cantidad). Los usan «Mi sala» y
 * «Mis notas»; cada vista decide qué cuenta (niños y niñas o notas).
 */
export function ChipsSala({
  salas,
  sala,
  onSala,
  cantidadPorSala,
}: {
  salas: string[];
  sala: string | null;
  onSala: (sala: string | null) => void;
  cantidadPorSala: (sala: string) => number;
}) {
  return (
    <>
      <FiltroSala etiqueta="Todas las salas" activo={sala === null} onClick={() => onSala(null)} />
      {salas.map((s) => (
        <FiltroSala
          key={s}
          etiqueta={etiquetaSala(s)}
          cantidad={cantidadPorSala(s)}
          activo={sala === s}
          onClick={() => onSala(s)}
        />
      ))}
    </>
  );
}

function FiltroSala({
  etiqueta,
  cantidad,
  activo,
  onClick,
}: {
  etiqueta: string;
  cantidad?: number;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <Chip
      onClick={onClick}
      aria-pressed={activo}
      label={
        <>
          {etiqueta}
          {cantidad !== undefined && (
            <Box component="span" sx={{ ml: 1, fontWeight: 600, opacity: 0.75 }}>
              {cantidad}
            </Box>
          )}
        </>
      }
      sx={{
        height: 44,
        px: 0.5,
        bgcolor: activo ? colores.texto : '#fff',
        color: activo ? '#fff' : 'text.primary',
        border: 1,
        borderColor: activo ? colores.texto : 'divider',
        '&.MuiChip-clickable:hover': { bgcolor: activo ? colores.texto : colores.crema },
      }}
    />
  );
}
