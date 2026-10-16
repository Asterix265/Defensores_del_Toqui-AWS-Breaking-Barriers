import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { etiquetaSala } from '../api';
import type { Nino } from '../datos';
import {
  AVISO_PROMEDIO_SIMPLE,
  DIFERENCIA_REZAGO,
  formatoEdad,
  formatoNivel,
  resumenSala,
} from '../niveles';
import { useNotas } from '../registrar';
import { descargarCsv, salasACsv } from '../reporte';
import { colores } from '../tema';
import { AvisoIncompleto } from './AvisoIncompleto';
import { useEstadoNinos } from './estadoNinos';
import { desde } from './periodo';
import { TituloVista } from './TituloVista';

const COLUMNAS = [
  'Sala',
  'Niños y niñas',
  'Edades',
  'Nivel prom. simple',
  'Para revisar',
  'Sin nivel',
  'Notas 7 días',
  '',
];

/**
 * Vista general del jardín (pensada para la directora): todas las salas a la vez con sus
 * métricas, cuántos niños o niñas quedan para revisar (bajo la mayoría de su sala en algún
 * núcleo), edades y notas de la semana. Los niveles son estimaciones pedagógicas, no
 * diagnósticos. Cada fila abre la sala en «Mi sala».
 */
export function VistaJardin({
  ninos,
  salas,
  ahora,
  onAbrirSala,
}: {
  ninos: Nino[];
  salas: string[];
  ahora: Date;
  onAbrirSala: (sala: string) => void;
}) {
  const { estados, rezagos, cargando, fallidos, salasIncompletas, completo, reintentar } =
    useEstadoNinos(ninos, ahora);
  const notas = useNotas(ninos, { estado: 'confirmada' });
  // Todo cargó: solo así las métricas son totales y se permite el CSV.
  const todoCargado = completo && notas.isSuccess;
  const incompleto = salasIncompletas.size > 0;
  const limite = desde('7dias', ahora)!;
  const notasSemana = (notas.data ?? []).filter((n) => n.creada >= limite);
  const resumenes = salas.map((s) => ({
    ...resumenSala(s, ninos, estados, rezagos),
    notas7Dias: notasSemana.filter((n) => n.nino.sala === s).length,
  }));
  const paraRevisar = resumenes.reduce((t, r) => t + r.paraRevisar, 0);
  const sinNivel = resumenes.reduce((t, r) => t + r.sinNivel, 0);
  const pendiente = (valor: string) => (cargando ? '…' : valor);
  const parcial = (valor: string, sala?: string) =>
    (sala ? salasIncompletas.has(sala) : incompleto) ? `${valor} (parcial)` : valor;
  const notasTexto = (valor: string) =>
    notas.isPending ? '…' : notas.isError ? 'Sin datos' : valor;

  const descargar = () => {
    // Un CSV con salas o notas faltantes aparentaría estar completo.
    if (!todoCargado) return;
    const fecha = ahora.toISOString().slice(0, 10);
    descargarCsv(`jardin-salas-${fecha}.csv`, salasACsv(resumenes));
  };

  const indicadores = [
    { etiqueta: 'Salas', valor: String(salas.length) },
    { etiqueta: 'Niños y niñas', valor: String(ninos.length) },
    {
      etiqueta: 'Para revisar',
      valor: pendiente(parcial(String(paraRevisar))),
      alerta: paraRevisar > 0,
    },
    { etiqueta: 'Sin nivel registrado', valor: pendiente(parcial(String(sinNivel))) },
    { etiqueta: 'Notas confirmadas (7 días)', valor: notasTexto(String(notasSemana.length)) },
  ];

  return (
    <>
      <TituloVista
        titulo="Vista general del jardín"
        subtitulo={`${salas.length} salas · ${ninos.length} niños y niñas · estimación pedagógica, no diagnóstico`}
      >
        <Button
          variant="outlined"
          startIcon={<DownloadRounded />}
          disabled={!todoCargado || salas.length === 0}
          onClick={descargar}
          sx={{ minHeight: 52, px: 3, fontSize: 17, bgcolor: '#fff' }}
        >
          Descargar CSV
        </Button>
      </TituloVista>

      <Box
        component="dl"
        sx={{
          m: 0,
          pt: 3,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 1.5,
        }}
      >
        {indicadores.map((i) => {
          const alerta = i.alerta && !cargando;
          return (
            <Box
              key={i.etiqueta}
              sx={{
                px: 2.5,
                py: 2,
                bgcolor: alerta ? colores.rojoSuave : '#fff',
                border: 1,
                borderColor: alerta ? colores.rojo : 'divider',
                borderRadius: '16px',
              }}
            >
              <Box component="dt" sx={{ fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>
                {i.etiqueta}
              </Box>
              <Box component="dd" sx={{ m: 0, fontSize: 30, fontWeight: 800 }}>
                {i.valor}
              </Box>
            </Box>
          );
        })}
      </Box>

      {(fallidos.size > 0 || notas.isError) && (
        <AvisoIncompleto
          faltan={fallidos.size}
          notas={notas.isError}
          onReintentar={() => {
            reintentar();
            if (notas.isError) void notas.refetch();
          }}
        />
      )}

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
          aria-label="Estado de las salas"
          sx={{
            '& td, & th': { borderColor: 'divider', px: 2.5 },
            '& td': { py: 1.75, fontSize: 16 },
          }}
        >
          <TableHead>
            <TableRow sx={{ bgcolor: colores.cremaRosa }}>
              {COLUMNAS.map((titulo, i) => (
                <TableCell
                  key={i}
                  sx={{
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
            {resumenes.map((r) => {
              const sinCalcular = salasIncompletas.has(r.sala);
              const alerta = !cargando && !sinCalcular && r.paraRevisar > 0;
              return (
                <TableRow
                  key={r.sala}
                  hover
                  onClick={() => onAbrirSala(r.sala)}
                  sx={{ cursor: 'pointer', bgcolor: alerta ? colores.rojoSuave : undefined }}
                >
                  <TableCell sx={{ fontWeight: 800 }}>
                    {etiquetaSala(r.sala)}
                    {sinCalcular && (
                      <Box
                        component="span"
                        sx={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 700,
                          color: colores.amarilloTinta,
                        }}
                      >
                        Datos incompletos: {r.sinCargar} sin cargar
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>{r.ninos}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {r.edadMin === null || r.edadMax === null || r.edadPromedio === null
                      ? '—'
                      : `${r.edadMin}–${r.edadMax} meses · prom. ${formatoEdad(r.edadPromedio)}`}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {pendiente(
                      r.nivelPromedio === null
                        ? '—'
                        : parcial(formatoNivel(r.nivelPromedio), r.sala),
                    )}
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 800, color: alerta ? colores.rojoOscuro : 'text.primary' }}
                  >
                    {pendiente(sinCalcular ? 'Sin calcular' : String(r.paraRevisar))}
                  </TableCell>
                  <TableCell>{pendiente(parcial(String(r.sinNivel), r.sala))}</TableCell>
                  <TableCell>{notasTexto(String(r.notas7Dias))}</TableCell>
                  <TableCell sx={{ width: 56 }}>
                    <Button
                      variant="text"
                      aria-label={`Ver ${etiquetaSala(r.sala)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrirSala(r.sala);
                      }}
                      sx={{ minWidth: 0, minHeight: 40, px: 1 }}
                    >
                      <ChevronRightRounded />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Typography variant="caption" component="p" color="text.secondary" sx={{ pt: 1.5, px: 0.5 }}>
        {AVISO_PROMEDIO_SIMPLE} «Para revisar»: niños o niñas {DIFERENCIA_REZAGO} niveles o más bajo
        la mediana de su sala en algún núcleo. Sin registros no hay nivel, y eso no significa que no
        lo haya logrado.
      </Typography>
    </>
  );
}
