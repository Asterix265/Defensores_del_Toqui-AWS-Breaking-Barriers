import Box from '@mui/material/Box';
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

const COLUMNAS = [
  { titulo: 'Niño/a', ancho: '200px' },
  { titulo: 'Sala · Registró', ancho: '190px' },
  { titulo: 'Nota', ancho: 'auto' },
  { titulo: 'Área', ancho: '170px' },
  { titulo: 'Cuándo', ancho: '150px' },
];

export function TablaNotas({ notas, ahora }: { notas: NotaGuardada[]; ahora: Date }) {
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

function FilaNota({ nota, ahora }: { nota: NotaGuardada; ahora: Date }) {
  const { nino } = nota;
  const Icono = ICONO_FORMATO[nota.formato];
  return (
    <TableRow>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 700 }}>
          <NinoAvatar nino={nino} tamano={36} />
          {nino.nombre}
        </Box>
      </TableCell>
      <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {etiquetaSala(nino.sala)}
        <br />
        {nota.autor}
      </TableCell>
      <TableCell>{nota.texto ?? 'Sin texto'}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {nota.dominios.map((d) => (
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
