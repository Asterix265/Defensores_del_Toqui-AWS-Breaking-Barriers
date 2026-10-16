import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { etiquetaSala, useObservacionesDe } from '../api';
import { areasSinNotas, DIAS_PERIODO, registrosDe, resumenAreas } from '../areas';
import { NinoAvatar } from '../componentes';
import { NUCLEOS, type Nino } from '../datos';
import { alertasPorNino, useEstadoSala } from '../estado';
import { colores } from '../tema';
import { EstadoSala } from './EstadoSala';
import { ChipsSala } from './FiltrosPanel';
import { BotonNuevaNota, TituloVista } from './TituloVista';

/**
 * Pestaña «Mi sala» en escritorio: tarjetas de los niños y niñas con cuántas áreas siguen sin
 * notas en 30 días. Con «Todas las salas» se agrupan por sala.
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
  /** Cadena vacía si no hay sala propia (directora). */
  salaPropia: string;
  ahora: Date;
  sala: string | null;
  onSala: (sala: string | null) => void;
  onAbrir: (ninoId: string) => void;
  /** Sin esta acción (directora) no se muestra «Nueva nota». */
  onNuevaNota?: () => void;
}) {
  // Con «Todas las salas» el estado por área es el de la sala propia; sin ella (directora), ninguno.
  const salaEstado = sala ?? (salaPropia || null);
  const alertas = alertasPorNino(useEstadoSala(salaEstado).data);
  const salas = sala ? [sala] : todas;
  const ninosDeSala = (s: string) => ninos.filter((n) => n.sala === s);
  const visibles = ninos.filter((n) => salas.includes(n.sala));
  const observaciones = useObservacionesDe(visibles.map((n) => n.id));
  // Mientras carga no se muestra la cuenta, para no anunciar áreas «sin notas» por error.
  const sinNotasDe = (nino: Nino) => {
    const consulta = observaciones[visibles.indexOf(nino)];
    return consulta?.isSuccess ? areasSinNotas(resumenAreas(registrosDe(consulta.data), ahora)) : 0;
  };

  return (
    <>
      <TituloVista
        titulo={salaPropia ? 'Mi sala' : 'Salas'}
        subtitulo={`${visibles.length} niños y niñas · áreas con notas en los últimos ${DIAS_PERIODO} días`}
      >
        {onNuevaNota && <BotonNuevaNota onClick={onNuevaNota} />}
      </TituloVista>

      <Box sx={{ pt: 3, display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <ChipsSala
          salas={todas}
          sala={sala}
          onSala={onSala}
          cantidadPorSala={(s) => ninosDeSala(s).length}
        />
      </Box>

      {!salaEstado && (
        <Typography sx={{ pt: 3, px: 0.5, color: 'text.secondary', fontWeight: 600 }}>
          Elige una sala para ver su estado por área.
        </Typography>
      )}

      {salaEstado && (
        <EstadoSala
          sala={salaEstado}
          ninos={ninos}
          titulo={`Estado por área · ${etiquetaSala(salaEstado)}${
            salaEstado === salaPropia ? ' (tu sala)' : ''
          }`}
          onAbrir={onAbrir}
        />
      )}

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
                  sinNotas={sinNotasDe(nino)}
                  paraRevisar={alertas.get(nino.id)?.length ?? 0}
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

function TarjetaNino({
  nino,
  sinNotas,
  paraRevisar,
  onClick,
}: {
  nino: Nino;
  sinNotas: number;
  /** Áreas con alerta relativa a la sala (reglas de demostración, no diagnóstico). */
  paraRevisar: number;
  onClick: () => void;
}) {
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
        bgcolor: '#fff',
        border: paraRevisar > 0 ? 2 : 1,
        borderColor: paraRevisar > 0 ? colores.amarillo : 'divider',
        borderRadius: '16px',
        '&:hover': { borderColor: colores.textoSuave },
      }}
    >
      <NinoAvatar nino={nino} tamano={48} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontSize: 17, fontWeight: 700 }}>{nino.nombre}</Box>
        {paraRevisar > 0 && (
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              mt: 0.5,
              mr: 0.75,
              px: 1.25,
              py: 0.25,
              borderRadius: 999,
              bgcolor: colores.rojoSuave,
              color: colores.rojoOscuro,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Revisar {paraRevisar} {paraRevisar === 1 ? 'área' : 'áreas'}
          </Box>
        )}
        {sinNotas > 0 ? (
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
