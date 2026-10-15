import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { ChipArea, ICONO_FORMATO, NinoAvatar } from '../componentes';
import { NINOS, type Nota } from '../datos';
import { formatoCuando } from '../formato';
import { colores } from '../tema';

const COLUMNAS = [
  { titulo: 'Niño/a', ancho: '200px' },
  { titulo: 'Sala · Tía', ancho: '190px' },
  { titulo: 'Nota', ancho: 'auto' },
  { titulo: 'Área', ancho: '170px' },
  { titulo: 'Cuándo', ancho: '150px' },
];

export function TablaNotas({ notas, ahora }: { notas: Nota[]; ahora: Date }) {
  return (
    <Box
      sx={{
        mt: 2.5,
        bgcolor: '#fff',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <Table
        sx={{
          tableLayout: 'fixed',
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
            <FilaNota key={nota.id} nota={nota} ahora={ahora} />
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

function FilaNota({ nota, ahora }: { nota: Nota; ahora: Date }) {
  const nino = NINOS.find((n) => n.id === nota.ninoId);
  const Icono = ICONO_FORMATO[nota.formato];
  return (
    <TableRow>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 700 }}>
          {nino && <NinoAvatar nino={nino} tamano={36} />}
          {nino?.nombre}
        </Box>
      </TableCell>
      <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {nino?.sala}
        <br />
        Tía {nota.educadora}
      </TableCell>
      <TableCell>{nota.texto}</TableCell>
      <TableCell>
        <ChipArea area={nota.area} compacto />
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
