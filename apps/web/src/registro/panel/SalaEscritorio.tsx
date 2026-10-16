import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { etiquetaSala } from '../api';
import { DIAS_PERIODO } from '../areas';
import { NinoAvatar } from '../componentes';
import { ETIQUETA_NUCLEO, NUCLEOS, type Nino, type Nucleo } from '../datos';
import {
  AVISO_PROMEDIO_SIMPLE,
  DIFERENCIA_REZAGO,
  formatoEdad,
  formatoNivel,
  resumenSala,
  type ResumenSala,
} from '../niveles';
import { descargarCsv, ninosACsv } from '../reporte';
import { colores } from '../tema';
import { AvisoIncompleto } from './AvisoIncompleto';
import { useEstadoNinos } from './estadoNinos';
import { ChipsSala } from './FiltrosPanel';
import { BotonNuevaNota, TituloVista } from './TituloVista';

/**
 * Pestaña «Mi sala» en escritorio: tarjetas de los niños y niñas con su nivel promedio estimado
 * y cuántas áreas siguen sin notas en 30 días. Cada sala muestra sus métricas, y quienes quedan
 * bajo la mayoría de su sala en algún núcleo se resaltan «para revisar» (estimación pedagógica,
 * no diagnóstico). Con «Todas las salas» se agrupan por sala. El CSV baja lo visible.
 */
export function SalaEscritorio({
  ninos,
  salas: todas,
  salaPropia,
  ahora,
  sala,
  onSala,
  onAbrir,
  onNuevaNota,
}: {
  ninos: Nino[];
  salas: string[];
  salaPropia: string;
  ahora: Date;
  sala: string | null;
  onSala: (sala: string | null) => void;
  onAbrir: (ninoId: string) => void;
  onNuevaNota: () => void;
}) {
  const salas = sala ? [sala] : todas;
  const ninosDeSala = (s: string) => ninos.filter((n) => n.sala === s);
  const visibles = ninos.filter((n) => salas.includes(n.sala));
  const { estados, sinNotas, rezagos, cargando, fallidos, salasIncompletas, completo, reintentar } =
    useEstadoNinos(visibles, ahora);

  const descargar = () => {
    // Un CSV con trayectorias faltantes aparentaría estar completo.
    if (!completo) return;
    const fecha = ahora.toISOString().slice(0, 10);
    descargarCsv(
      `estado-${sala ?? 'salas'}-${fecha}.csv`,
      ninosACsv(visibles, estados, rezagos, sinNotas),
    );
  };

  return (
    <>
      <TituloVista
        titulo="Mi sala"
        subtitulo={`${visibles.length} niños y niñas · áreas con notas en los últimos ${DIAS_PERIODO} días`}
      >
        <Button
          variant="outlined"
          startIcon={<DownloadRounded />}
          disabled={!completo || visibles.length === 0}
          onClick={descargar}
          sx={{ minHeight: 52, px: 3, fontSize: 17, bgcolor: '#fff' }}
        >
          Descargar CSV
        </Button>
        <BotonNuevaNota onClick={onNuevaNota} />
      </TituloVista>

      <Box sx={{ pt: 3, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <ChipsSala
          salas={todas}
          sala={sala}
          onSala={onSala}
          cantidadPorSala={(s) => ninosDeSala(s).length}
        />
      </Box>

      <Typography variant="caption" component="p" color="text.secondary" sx={{ pt: 1.5, px: 0.5 }}>
        {AVISO_PROMEDIO_SIMPLE} «Para revisar»: {DIFERENCIA_REZAGO} niveles o más bajo la mediana de
        su sala en un núcleo. Es una estimación pedagógica para revisar, no un diagnóstico; sin
        registros no hay nivel.
      </Typography>

      {fallidos.size > 0 && <AvisoIncompleto faltan={fallidos.size} onReintentar={reintentar} />}

      {salas.map((s) => (
        <Box key={s} component="section" aria-label={etiquetaSala(s)} sx={{ pt: 3 }}>
          {!sala && (
            <Typography
              variant="h2"
              color="text.secondary"
              sx={{ pb: 1.5, px: 0.5, textTransform: 'uppercase' }}
            >
              {etiquetaSala(s)}
              {s === salaPropia && ' · Tu sala'}
            </Typography>
          )}
          <MetricasSala
            resumen={resumenSala(s, ninos, estados, rezagos)}
            cargando={cargando}
            incompleta={salasIncompletas.has(s)}
          />
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 1.5,
            }}
          >
            {ninosDeSala(s).map((nino) => (
              <li key={nino.id}>
                <TarjetaNino
                  nino={nino}
                  // Sin trayectoria cargada no se muestra la cuenta, para no anunciar áreas por error.
                  sinNotas={sinNotas.get(nino.id) ?? null}
                  fallo={fallidos.has(nino.id)}
                  promedio={estados.get(nino.id)?.promedio ?? null}
                  bajoSuSala={rezagos.get(nino.id) ?? []}
                  onClick={() => onAbrir(nino.id)}
                />
              </li>
            ))}
          </Box>
        </Box>
      ))}
    </>
  );
}

/**
 * Métricas de la sala: niños y niñas, edades, nivel promedio y cuántos quedan para revisar. Si
 * faltan trayectorias (`incompleta`), los valores se rotulan como parciales y el rezago no se
 * calcula.
 */
function MetricasSala({
  resumen,
  cargando,
  incompleta,
}: {
  resumen: ResumenSala;
  cargando: boolean;
  incompleta: boolean;
}) {
  const { edadMin, edadMax, edadPromedio, nivelPromedio, paraRevisar, sinNivel, sinCargar } =
    resumen;
  const parcial = (valor: string) => (incompleta ? `${valor} (parcial)` : valor);
  const edades =
    edadMin === null || edadMax === null || edadPromedio === null
      ? '—'
      : `${edadMin}–${edadMax} meses (prom. ${formatoEdad(edadPromedio)})`;
  const metricas = [
    { etiqueta: 'Niños y niñas', valor: String(resumen.ninos) },
    { etiqueta: 'Edades', valor: edades },
    {
      etiqueta: 'Nivel promedio simple',
      valor: cargando
        ? '…'
        : nivelPromedio === null
          ? incompleta
            ? 'Sin datos'
            : 'Sin registros'
          : parcial(formatoNivel(nivelPromedio)),
    },
    {
      etiqueta: 'Para revisar',
      valor: cargando ? '…' : incompleta ? 'Sin calcular' : String(paraRevisar),
      alerta: !incompleta && paraRevisar > 0,
    },
    { etiqueta: 'Sin nivel registrado', valor: cargando ? '…' : parcial(String(sinNivel)) },
    ...(incompleta && !cargando
      ? [{ etiqueta: 'Sin cargar', valor: String(sinCargar), aviso: true }]
      : []),
  ];
  return (
    <Box component="dl" sx={{ m: 0, pb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
      {metricas.map((m) => (
        <Box
          key={m.etiqueta}
          sx={{
            px: 2,
            py: 1,
            bgcolor:
              m.alerta && !cargando
                ? colores.rojoSuave
                : 'aviso' in m
                  ? colores.amarilloSuave
                  : '#fff',
            border: 1,
            borderColor:
              m.alerta && !cargando ? colores.rojo : 'aviso' in m ? colores.amarillo : 'divider',
            borderRadius: '12px',
          }}
        >
          <Box component="dt" sx={{ fontSize: 13, fontWeight: 700, color: 'text.secondary' }}>
            {m.etiqueta}
          </Box>
          <Box component="dd" sx={{ m: 0, fontSize: 17, fontWeight: 800 }}>
            {m.valor}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function TarjetaNino({
  nino,
  sinNotas,
  fallo,
  promedio,
  bajoSuSala,
  onClick,
}: {
  nino: Nino;
  /** Áreas sin notas en 30 días; `null` mientras su trayectoria no está cargada. */
  sinNotas: number | null;
  /** No se pudo cargar su trayectoria. */
  fallo: boolean;
  promedio: number | null;
  /** Núcleos en que queda bajo la mayoría de su sala. */
  bajoSuSala: Nucleo[];
  onClick: () => void;
}) {
  const paraRevisar = bajoSuSala.length > 0;
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 72,
        px: 2,
        py: 1.5,
        gap: 1.5,
        justifyContent: 'flex-start',
        textAlign: 'left',
        bgcolor: paraRevisar ? colores.rojoSuave : '#fff',
        border: paraRevisar ? 2 : 1,
        borderColor: paraRevisar ? colores.rojo : 'divider',
        borderRadius: '16px',
        '&:hover': { borderColor: paraRevisar ? colores.rojoOscuro : colores.textoSuave },
      }}
    >
      <NinoAvatar nino={nino} tamano={48} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Box sx={{ fontSize: 17, fontWeight: 700 }}>{nino.nombre}</Box>
          {promedio !== null && (
            <Box sx={{ ml: 'auto', fontSize: 14, fontWeight: 700, color: 'text.secondary' }}>
              Nivel prom. simple {formatoNivel(promedio)}
            </Box>
          )}
        </Box>
        {paraRevisar && (
          <Box sx={{ mt: 0.5, fontSize: 14, fontWeight: 700, color: colores.rojoOscuro }}>
            Para revisar: bajo su sala en {bajoSuSala.map((d) => ETIQUETA_NUCLEO[d]).join(', ')}
          </Box>
        )}
        {fallo ? (
          <Box sx={{ mt: 0.5, fontSize: 14, fontWeight: 700, color: colores.amarilloTinta }}>
            No se pudieron cargar sus registros
          </Box>
        ) : sinNotas === null ? (
          <Box sx={{ mt: 0.5, fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>
            Cargando registros…
          </Box>
        ) : sinNotas > 0 ? (
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              mt: 0.5,
              px: 1.25,
              py: 0.25,
              borderRadius: 999,
              bgcolor: colores.amarilloSuave,
              color: colores.amarilloTinta,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {sinNotas} {sinNotas === 1 ? 'área' : 'áreas'} sin notas
          </Box>
        ) : (
          <Box sx={{ mt: 0.5, fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>
            Notas en las {NUCLEOS.length} áreas
          </Box>
        )}
      </Box>
      <ChevronRightRounded sx={{ color: 'text.secondary' }} />
    </ButtonBase>
  );
}
