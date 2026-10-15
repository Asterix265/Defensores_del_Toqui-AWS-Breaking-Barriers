import { useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CalendarTodayRounded from '@mui/icons-material/CalendarTodayRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { ChipArea, ICONO_FORMATO, NinoAvatar, formatoCuando } from './componentes';
import { NINOS, SALAS, type Nota } from './datos';
import { descargarCsv, notasACsv } from './reporte';
import { colores } from './tema';

type Periodo = 'hoy' | '7dias' | 'todo';

const ETIQUETA_PERIODO: Record<Periodo, string> = {
  hoy: 'Hoy',
  '7dias': 'Últimos 7 días',
  todo: 'Todo',
};

function desde(periodo: Periodo, ahora: Date): Date | null {
  if (periodo === 'todo') return null;
  const inicio = new Date(ahora);
  inicio.setHours(0, 0, 0, 0);
  if (periodo === '7dias') inicio.setDate(inicio.getDate() - 6);
  return inicio;
}

function iniciales(nombre: string): string {
  return nombre.slice(0, 2).toUpperCase();
}

/** Vista de escritorio (diseño 1e): notas de todas las salas y descarga del reporte. */
export function PanelSalas({
  notas,
  ahora,
  nombre,
}: {
  notas: Nota[];
  ahora: Date;
  nombre: string;
}) {
  const [sala, setSala] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('7dias');

  const limite = desde(periodo, ahora);
  const delPeriodo = notas
    .filter((n) => !limite || n.creada >= limite)
    .sort((a, b) => b.creada.getTime() - a.creada.getTime());
  const salaDe = (nota: Nota) => NINOS.find((n) => n.id === nota.ninoId)?.sala;
  const visibles = sala ? delPeriodo.filter((n) => salaDe(n) === sala) : delPeriodo;

  const descargar = () => {
    const fecha = ahora.toISOString().slice(0, 10);
    descargarCsv(`notas-salas-${fecha}.csv`, notasACsv(visibles));
  };

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
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

      <Box component="main" sx={{ maxWidth: 1280, mx: 'auto', px: 5, pt: 4, pb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
          <Box>
            <Typography variant="h1" sx={{ fontSize: 32, lineHeight: '40px' }}>
              Notas de las salas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {ETIQUETA_PERIODO[periodo]} · {visibles.length}{' '}
              {visibles.length === 1 ? 'nota' : 'notas'}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadRounded />}
            disabled={visibles.length === 0}
            onClick={descargar}
            sx={{
              ml: 'auto',
              minHeight: 52,
              px: 3,
              fontSize: 17,
              boxShadow: '0 8px 24px -4px rgba(214,40,57,.3)',
            }}
          >
            Descargar reporte
          </Button>
        </Box>

        <Box sx={{ pt: 3, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
          <FiltroSala
            etiqueta="Todas las salas"
            activo={sala === null}
            onClick={() => setSala(null)}
          />
          {SALAS.map((s) => (
            <FiltroSala
              key={s}
              etiqueta={s}
              cantidad={delPeriodo.filter((n) => salaDe(n) === s).length}
              activo={sala === s}
              onClick={() => setSala(s)}
            />
          ))}
          <Select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
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
                {['Niño/a', 'Sala · Tía', 'Nota', 'Área', 'Cuándo'].map((titulo, i) => (
                  <TableCell
                    key={titulo}
                    sx={{
                      width: ['200px', '190px', 'auto', '170px', '150px'][i],
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
              {visibles.map((nota) => (
                <FilaNota key={nota.id} nota={nota} ahora={ahora} />
              ))}
              {visibles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    No hay notas en este periodo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
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
