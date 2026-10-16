import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { ChipArea, ICONO_FORMATO, NinoAvatar } from '../componentes';
import { etiquetaSala } from '../api';
import type { NotaGuardada } from '../registrar';
import { formatoCuando } from '../formato';
import { colores } from '../tema';

/** Anchos relativos: entre 900 y 1100 px la columna «Nota» no queda aplastada. */
const COLUMNAS = [
  { titulo: 'Niño/a', ancho: '19%' },
  { titulo: 'Sala · Registró', ancho: '20%' },
  { titulo: 'Nota', ancho: 'auto' },
  { titulo: 'Área', ancho: '16%' },
  { titulo: 'Cuándo', ancho: '136px' },
];

/** Una línea con «…» si no cabe; el texto completo queda en el título. */
const unaLinea = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** Notas de la tabla; cada fila abre su detalle (`onAbrir`). */
export function TablaNotas({
  notas,
  ahora,
  onAbrir,
}: {
  notas: NotaGuardada[];
  ahora: Date;
  onAbrir: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        mt: 2.5,
        bgcolor: '#fff',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        overflowX: 'auto',
      }}
    >
      <Table
        sx={{
          tableLayout: 'fixed',
          minWidth: 760,
          '& td, & th': { borderColor: 'divider', px: 2.5 },
          '& td': { py: 2, fontSize: 16, lineHeight: '24px' },
        }}
      >
        <TableHead>
          <TableRow sx={{ bgcolor: colores.cremaRosa }}>
            {COLUMNAS.map(({ titulo, ancho }) => (
              <TableCell
                key={titulo}
                sx={{
                  width: ancho,
                  fontSize: 13,
                  fontWeight: 800,
                  color: 'text.secondary',
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                }}
              >
                {titulo}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {notas.map((nota) => (
            <FilaNota key={nota.id} nota={nota} ahora={ahora} onAbrir={() => onAbrir(nota.id)} />
          ))}
          {notas.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={COLUMNAS.length}
                sx={{ textAlign: 'center', color: 'text.secondary' }}
              >
                No hay notas en este periodo.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

function FilaNota({
  nota,
  ahora,
  onAbrir,
}: {
  nota: NotaGuardada;
  ahora: Date;
  onAbrir: () => void;
}) {
  const { nino } = nota;
  const Icono = ICONO_FORMATO[nota.formato];
  return (
    <TableRow
      hover
      onClick={onAbrir}
      sx={{ cursor: 'pointer', '&.MuiTableRow-hover:hover': { bgcolor: colores.crema } }}
    >
      <TableCell>
        {/* El botón da acceso con teclado; el clic en cualquier parte de la fila hace lo mismo. */}
        <ButtonBase
          aria-label={`Ver nota de ${nino.nombre}`}
          onClick={(e) => {
            e.stopPropagation();
            onAbrir();
          }}
          sx={{
            maxWidth: '100%',
            justifyContent: 'flex-start',
            gap: 1.25,
            fontSize: 16,
            fontWeight: 700,
            borderRadius: '8px',
            textAlign: 'left',
          }}
        >
          <NinoAvatar nino={nino} tamano={36} />
          <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {nino.nombre}
          </Box>
        </ButtonBase>
      </TableCell>
      <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
        <Box component="span" sx={unaLinea}>
          {etiquetaSala(nino.sala)}
        </Box>
        <Box component="span" title={nota.autor} sx={unaLinea}>
          {nota.autor}
        </Box>
      </TableCell>
      <TableCell sx={{ overflowWrap: 'anywhere' }}>{nota.texto ?? 'Sin texto'}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {nota.nucleos.map((d) => (
            <ChipArea key={d} area={d} compacto />
          ))}
        </Box>
      </TableCell>
      <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'nowrap' }}>
          <Icono sx={{ fontSize: 20 }} />
          {formatoCuando(nota.creada, ahora)}
        </Box>
      </TableCell>
    </TableRow>
  );
}
