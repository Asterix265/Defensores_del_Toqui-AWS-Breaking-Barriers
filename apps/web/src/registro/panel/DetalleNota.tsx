import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { getObtenerCapturaQueryKey, obtenerCaptura } from '../../api/generated/capturas/capturas';
import { etiquetaSala } from '../api';
import { ChipArea, NinoAvatar } from '../componentes';
import type { Nino, Nucleo } from '../datos';
import { formatoCuando } from '../formato';
import { colores } from '../tema';

/**
 * Detalle de solo lectura de una nota de la tabla: texto, nivel confirmado (estimación
 * pedagógica, no un diagnóstico), manifestaciones con su cita y quién la registró.
 */
export function DetalleNota({
  capturaId,
  ninos,
  onCerrar,
}: {
  capturaId: string;
  ninos: Nino[];
  onCerrar: () => void;
}) {
  const consulta = useQuery({
    queryKey: getObtenerCapturaQueryKey(capturaId),
    queryFn: async ({ signal }) => {
      const res = await obtenerCaptura(capturaId, { signal });
      if (res.status !== 200) throw new Error(`La API respondió ${res.status}`);
      return res.data;
    },
  });
  const captura = consulta.data;
  const nino = captura && ninos.find((n) => n.id === captura.nino.id);
  const texto = captura?.texto ?? captura?.borrador?.textoFuente ?? null;
  const observacion = captura?.observacion;

  return (
    <Dialog
      open
      onClose={onCerrar}
      fullWidth
      maxWidth="sm"
      aria-labelledby="titulo-detalle-nota"
      slotProps={{ paper: { sx: { borderRadius: '24px' } } }}
    >
      <DialogTitle id="titulo-detalle-nota" sx={{ fontWeight: 800 }}>
        Nota{nino ? ` de ${nino.nombre}` : ''}
      </DialogTitle>
      <DialogContent>
        {consulta.isPending && <CircularProgress aria-label="Cargando la nota" />}
        {consulta.isError && (
          <Typography role="alert" color="error">
            No se pudo cargar la nota.
          </Typography>
        )}
        {captura && (
          <Stack sx={{ gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {nino && <NinoAvatar nino={nino} tamano={44} />}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {etiquetaSala(captura.nino.sala)} ·{' '}
                  {formatoCuando(new Date(captura.creadoEn), new Date())}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  Registró {captura.autor}
                </Typography>
              </Box>
            </Box>
            {texto && (
              <Box
                sx={{
                  p: 1.75,
                  bgcolor: colores.amarilloSuave,
                  borderRadius: '12px',
                  fontSize: 17,
                  lineHeight: '26px',
                }}
              >
                {texto}
              </Box>
            )}
            {observacion && (
              <>
                <Typography variant="body2">
                  Nivel {observacion.nivel}{' '}
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    (estimación pedagógica, no un diagnóstico)
                  </Box>
                </Typography>
                <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0, gap: 1 }}>
                  {observacion.manifestaciones.map(({ manifestacion, cita }) => (
                    <Stack
                      component="li"
                      key={manifestacion.id}
                      sx={{
                        p: 1.5,
                        gap: 0.75,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: '12px',
                      }}
                    >
                      <Box>
                        <ChipArea area={manifestacion.nucleo as Nucleo} compacto />
                      </Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
                        {manifestacion.textoObservable}
                      </Typography>
                      {cita && (
                        <Typography variant="body2" color="text.secondary">
                          «{cita}»
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="text" onClick={onCerrar}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
