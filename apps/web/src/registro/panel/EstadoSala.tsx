import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import { etiquetaSala } from '../api';
import { NinoAvatar } from '../componentes';
import { COLOR_NUCLEO, type Nino, type Nucleo } from '../datos';
import {
  alertasPorNino,
  estadoSalaACsv,
  etiquetaNucleo,
  formatoNivel,
  useEstadoSala,
  type ResumenNucleo,
} from '../estado';
import { aCsv, descargarCsv } from '../reporte';
import { colores } from '../tema';

const NIVELES = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Estado de la sala por área (panel-directora-y-aprendizaje): nivel validado vigente de cada
 * niño o niña, mediana, cobertura y quiénes quedan para revisar en contexto. Se usa en «Mi sala»
 * del panel y del celular, y en el detalle de una sala de la vista del jardín.
 */
export function EstadoSala({
  sala,
  ninos,
  compacto = false,
  titulo = 'Estado de la sala por área',
  onAbrir,
}: {
  sala: string;
  titulo?: string;
  ninos: Nino[];
  /** Celular: una columna y menos texto. */
  compacto?: boolean;
  onAbrir: (ninoId: string) => void;
}) {
  const consulta = useEstadoSala(sala);
  const estado = consulta.data;

  if (consulta.isPending) {
    return (
      <Box role="status" sx={{ py: 3, display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <CircularProgress size={22} aria-hidden />
        <Typography variant="body2">Calculando el estado de la sala…</Typography>
      </Box>
    );
  }
  if (consulta.isError || !estado) {
    return (
      <Alert severity="error" sx={{ mt: 2, borderRadius: '14px' }}>
        No se pudo cargar el estado de la sala.
      </Alert>
    );
  }

  const alertas = alertasPorNino(estado);
  const conAlerta = ninos.filter((n) => n.sala === sala && alertas.has(n.id));
  const descargar = () => {
    const { columnas, filas } = estadoSalaACsv(estado, ninos);
    descargarCsv(`estado-${sala}-${estado.corte}.csv`, aCsv(columnas, filas));
  };

  return (
    <Box component="section" aria-label={`Estado de ${etiquetaSala(sala)}`} sx={{ pt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, pb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
            {titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Último nivel validado de hasta 45 días · corte {estado.corte} · {estado.matriculados}{' '}
            niños y niñas
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadRounded />}
          onClick={descargar}
          sx={{ ml: 'auto', minHeight: 44, px: 2, fontSize: 15, bgcolor: '#fff' }}
        >
          Descargar CSV
        </Button>
      </Box>

      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridTemplateColumns: compacto
            ? 'repeat(2, minmax(0, 1fr))'
            : 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 1.25,
        }}
      >
        {estado.nucleos.map((n) => (
          <li key={n.nucleo}>
            <TarjetaNucleo
              resumen={n}
              alertas={estado.alertas.filter((a) => a.nucleo === n.nucleo).length}
            />
          </li>
        ))}
      </Box>

      <Box sx={{ pt: 2.5 }}>
        <Typography variant="h2" color="text.secondary" sx={{ textTransform: 'uppercase', pb: 1 }}>
          Para revisar en contexto · {conAlerta.length}
        </Typography>
        {conAlerta.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nadie está 2 o más niveles bajo la mediana de su sala en ningún área.
          </Typography>
        ) : (
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'grid',
              gridTemplateColumns: compacto ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 1.25,
            }}
          >
            {conAlerta.map((nino) => (
              <li key={nino.id}>
                <ButtonBase
                  onClick={() => onAbrir(nino.id)}
                  aria-label={`Revisar a ${nino.nombre}`}
                  sx={{
                    width: '100%',
                    p: 1.5,
                    gap: 1.5,
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    bgcolor: colores.amarilloSuave,
                    border: 1,
                    borderColor: colores.amarillo,
                    borderRadius: '16px',
                  }}
                >
                  <NinoAvatar nino={nino} tamano={40} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontSize: 16, fontWeight: 800 }}>
                      {nino.nombre} · {nino.edadMeses} meses
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 0.5 }}>
                      {alertas.get(nino.id)!.map((a) => (
                        <Box
                          key={a.nucleo}
                          component="span"
                          sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: 999,
                            bgcolor: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'text.primary',
                          }}
                        >
                          {etiquetaNucleo(a.nucleo)}: nivel {a.nivelValidado} · sala{' '}
                          {formatoNivel(a.referencia)}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </ButtonBase>
              </li>
            ))}
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            pt: 1.5,
            color: 'text.secondary',
            alignItems: 'flex-start',
          }}
        >
          <ErrorOutlineRounded sx={{ fontSize: 18, mt: '2px' }} aria-hidden />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Regla de demostración de la metodología del dataset, no un diagnóstico: nivel validado{' '}
            {estado.reglas.brechaIndividual} o más posiciones bajo la mediana de al menos{' '}
            {estado.reglas.paresMinimos} pares de la misma sala. {estado.reglas.accionIndividual}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** Mediana, cobertura y distribución (1–8) de un área. Sin decisiones no se muestra nivel. */
function TarjetaNucleo({ resumen, alertas }: { resumen: ResumenNucleo; alertas: number }) {
  const color = COLOR_NUCLEO[resumen.nucleo as Nucleo] ?? COLOR_NUCLEO.IA;
  const maximo = Math.max(1, ...resumen.distribucion.map((d) => d.cantidad));
  const total = resumen.conDecision + resumen.sinDecision;
  const cantidad = (nivel: number) =>
    resumen.distribucion.find((d) => d.nivel === nivel)?.cantidad ?? 0;
  const descripcion = `${etiquetaNucleo(resumen.nucleo)}: mediana ${formatoNivel(
    resumen.mediana,
  )}, ${resumen.conDecision} de ${total} con decisión. Distribución: ${NIVELES.map(
    (n) => `nivel ${n}, ${cantidad(n)}`,
  ).join('; ')}`;

  return (
    <Box
      sx={{
        p: 1.5,
        height: '100%',
        bgcolor: '#fff',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="span"
          sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color.tinta }}
          aria-hidden
        />
        <Typography sx={{ fontSize: 15, fontWeight: 800 }}>
          {etiquetaNucleo(resumen.nucleo)}
        </Typography>
        {alertas > 0 && (
          <Box
            component="span"
            sx={{
              ml: 'auto',
              px: 1,
              borderRadius: 999,
              bgcolor: colores.amarilloSuave,
              color: colores.amarilloTinta,
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            {alertas} por revisar
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: '30px' }}>
          {formatoNivel(resumen.mediana)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          mediana · {resumen.conDecision}/{total} con decisión
        </Typography>
      </Box>
      {/* Distribución por nivel: una sola serie, el área ya la nombra el título. */}
      <Box
        role="img"
        aria-label={descripcion}
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px', pt: 0.5 }}
      >
        {NIVELES.map((nivel) => (
          <Tooltip key={nivel} title={`Nivel ${nivel}: ${cantidad(nivel)}`} placement="top">
            <Box
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
            >
              <Box sx={{ height: 36, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <Box
                  sx={{
                    width: '100%',
                    height: `${(cantidad(nivel) / maximo) * 100}%`,
                    minHeight: cantidad(nivel) ? 3 : 0,
                    bgcolor: color.tinta,
                    opacity: 0.85,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              </Box>
              <Box sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>{nivel}</Box>
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}
