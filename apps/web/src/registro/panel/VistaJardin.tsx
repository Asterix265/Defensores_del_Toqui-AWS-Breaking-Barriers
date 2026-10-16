import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { etiquetaSala, ordenarSalas } from '../api';
import {
  etiquetaNucleo,
  formatoNivel,
  porcentaje,
  resumenJardinACsv,
  useResumenJardin,
  type ResumenSala,
} from '../estado';
import { aCsv, descargarCsv } from '../reporte';
import { colores } from '../tema';
import { TituloVista } from './TituloVista';

/**
 * Vista general de la directora (panel-directora-y-aprendizaje): todas las salas del jardín a la
 * vez, con matrícula, edades, cobertura de decisiones, alertas y actividad de registro. Las salas
 * solo se comparan con otras del mismo nivel educativo.
 */
export function VistaJardin({ onAbrirSala }: { onAbrirSala: (sala: string) => void }) {
  const consulta = useResumenJardin();
  const resumen = consulta.data;

  if (consulta.isPending) {
    return (
      <Box role="status" sx={{ py: 6, display: 'flex', gap: 1.5, justifyContent: 'center' }}>
        <CircularProgress size={24} aria-hidden />
        <Typography variant="body2">Calculando el estado del jardín…</Typography>
      </Box>
    );
  }
  if (consulta.isError || !resumen) {
    return (
      <Alert severity="error" sx={{ borderRadius: '14px' }}>
        No se pudo cargar el estado del jardín.
      </Alert>
    );
  }

  const orden = ordenarSalas(resumen.salas.map((s) => s.sala));
  const salas = orden.map((s) => resumen.salas.find((r) => r.sala === s)!);
  const matriculados = salas.reduce((t, s) => t + s.matriculados, 0);
  const conAlerta = salas.reduce((t, s) => t + s.ninosConAlerta, 0);
  const alertasSala = salas.reduce((t, s) => t + s.alertasSala.length, 0);
  const cobertura = matriculados
    ? salas.reduce((t, s) => t + s.cobertura * s.matriculados, 0) / matriculados
    : 0;
  const observaciones = salas.reduce((t, s) => t + s.observaciones30Dias, 0);

  const descargar = () => {
    const { columnas, filas } = resumenJardinACsv(resumen);
    descargarCsv(`jardin-${resumen.idJardin}-${resumen.corte}.csv`, aCsv(columnas, filas));
  };

  return (
    <>
      <TituloVista
        titulo="Jardín"
        subtitulo={`${salas.length} salas · ${matriculados} niños y niñas · corte ${resumen.corte}`}
      >
        <Button
          variant="outlined"
          startIcon={<DownloadRounded />}
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 1.5,
        }}
      >
        <Indicador etiqueta="Niños y niñas para revisar" valor={String(conAlerta)} />
        <Indicador etiqueta="Alertas entre salas" valor={String(alertasSala)} />
        <Indicador etiqueta="Cobertura de decisiones" valor={porcentaje(cobertura)} />
        <Indicador etiqueta="Observaciones en 30 días" valor={String(observaciones)} />
      </Box>

      <Box
        component="ul"
        aria-label="Salas del jardín"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          pt: 3,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 1.5,
        }}
      >
        {salas.map((s) => (
          <li key={s.idSala}>
            <TarjetaSala sala={s} onAbrir={() => onAbrirSala(s.sala)} />
          </li>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" component="p" sx={{ pt: 2.5 }}>
        Reglas de demostración de la metodología del dataset, no criterios de Integra ni un
        diagnóstico. Alerta individual: {resumen.reglas.brechaIndividual} o más niveles bajo la
        mediana de al menos {resumen.reglas.paresMinimos} pares de la sala. Alerta entre salas: la
        mediana de la sala {formatoNivel(resumen.reglas.brechaSala)} o más bajo la de las otras
        salas del mismo nivel educativo. {resumen.reglas.accionSala}
      </Typography>
    </>
  );
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <Box sx={{ p: 2, bgcolor: '#fff', border: 1, borderColor: 'divider', borderRadius: '16px' }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {etiqueta}
      </Typography>
      <Typography component="dd" sx={{ m: 0, fontSize: 30, fontWeight: 800, lineHeight: '38px' }}>
        {valor}
      </Typography>
    </Box>
  );
}

function TarjetaSala({ sala, onAbrir }: { sala: ResumenSala; onAbrir: () => void }) {
  const edades =
    sala.edadMinMeses === null
      ? 'Sin matrícula'
      : `${sala.edadMinMeses}–${sala.edadMaxMeses} meses (prom. ${formatoNivel(
          sala.edadPromedioMeses,
        )})`;
  return (
    <ButtonBase
      onClick={onAbrir}
      aria-label={`Ver ${etiquetaSala(sala.sala)}`}
      sx={{
        width: '100%',
        height: '100%',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.25,
        bgcolor: '#fff',
        border: sala.alertasSala.length ? 2 : 1,
        borderColor: sala.alertasSala.length ? colores.amarillo : 'divider',
        borderRadius: '18px',
        '&:hover': { borderColor: colores.textoSuave },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 19, fontWeight: 800 }}>{etiquetaSala(sala.sala)}</Typography>
        <ChevronRightRounded sx={{ ml: 'auto', color: 'text.secondary' }} />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {sala.matriculados} niños y niñas · {edades}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        <Dato
          etiqueta="Para revisar"
          valor={String(sala.ninosConAlerta)}
          destacado={sala.ninosConAlerta > 0}
        />
        <Dato etiqueta="Cobertura" valor={porcentaje(sala.cobertura)} />
        <Dato etiqueta="Obs. 30 días" valor={String(sala.observaciones30Dias)} />
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Mediana por área
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pt: 0.5 }}>
          {sala.nucleos.map((n) => {
            const alerta = sala.alertasSala.some((a) => a.nucleo === n.nucleo);
            return (
              <Box
                key={n.nucleo}
                component="span"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  bgcolor: alerta ? colores.amarilloSuave : colores.crema,
                  color: alerta ? colores.amarilloTinta : 'text.primary',
                  border: 1,
                  borderColor: alerta ? colores.amarillo : 'divider',
                }}
              >
                {etiquetaNucleo(n.nucleo)} {formatoNivel(n.mediana)}
              </Box>
            );
          })}
        </Box>
      </Box>

      {sala.alertasSala.length > 0 && (
        <Typography variant="caption" sx={{ color: colores.amarilloTinta, fontWeight: 700 }}>
          Bajo las otras salas del mismo nivel en:{' '}
          {sala.alertasSala
            .map(
              (a) =>
                `${etiquetaNucleo(a.nucleo)} (${formatoNivel(a.mediana)} vs ${formatoNivel(a.referencia)})`,
            )
            .join(', ')}
        </Typography>
      )}
    </ButtonBase>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1,
        borderRadius: '12px',
        bgcolor: destacado ? colores.rojoSuave : colores.crema,
      }}
    >
      <Box sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>{etiqueta}</Box>
      <Box
        sx={{
          fontSize: 20,
          fontWeight: 800,
          color: destacado ? colores.rojoOscuro : 'text.primary',
        }}
      >
        {valor}
      </Box>
    </Box>
  );
}
