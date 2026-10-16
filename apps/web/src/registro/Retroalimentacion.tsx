import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TipsAndUpdatesRounded from '@mui/icons-material/TipsAndUpdatesRounded';
import { useObservaciones, type Manifestacion } from './api';
import { ChipArea } from './componentes';
import type { Nino } from './datos';
import { diaCorto } from './formato';
import { sugerenciasDe, type TipoSugerencia } from './sugerencias';
import { colores } from './tema';

/** «2026-10-13» → fecha local a mediodía. */
function fechaLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(anio, mes - 1, dia, 12);
}

const PASO: Record<Exclude<TipoSugerencia, 'tope'>, string> = {
  afianzar: 'La nota lo muestra solo en parte. Para afianzarlo, propicia y observa:',
  completar: 'Para completar lo que mostró, observa también:',
  avanzar: 'Ya mostró esto por completo. Próximo paso para propiciar y observar:',
};

/**
 * Retroalimentación a partir de lo que anotaron las tías: por cada área, la nota más reciente
 * que la registra, lo que esa nota evidencia y un próximo paso que depende de ella (ver
 * `sugerencias.ts`). Es una sugerencia para la educadora, no una evaluación: no muestra niveles
 * ni compara con otros niños o niñas.
 */
export function Retroalimentacion({
  nino,
  manifestaciones,
  ahora,
}: {
  nino: Nino;
  manifestaciones: Manifestacion[];
  ahora: Date;
}) {
  const observaciones = useObservaciones(nino.id);
  if (!observaciones.isSuccess) return null;
  const sugerencias = sugerenciasDe(observaciones.data, nino, manifestaciones);

  return (
    <Stack component="section" aria-label="Retroalimentación" sx={{ gap: 1.25 }}>
      <Typography
        variant="h2"
        sx={{ px: 0.5, color: 'text.secondary', textTransform: 'uppercase' }}
      >
        Retroalimentación
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        Según la nota más reciente de cada área: qué se vio y un próximo paso que depende de esa
        nota. Es una sugerencia para revisar, no una evaluación.
      </Typography>
      {sugerencias.length === 0 && (
        <Typography color="text.secondary" sx={{ px: 0.5 }}>
          Cuando haya notas de {nino.nombre}, aquí verás próximos pasos para cada área.
        </Typography>
      )}
      {sugerencias.map(({ nucleo, nota, cita, observadas, tipo, sugeridas }) => (
        <Stack
          key={nucleo}
          sx={{
            p: 1.75,
            gap: 1,
            bgcolor: '#fff',
            border: 1,
            borderColor: 'divider',
            borderRadius: '16px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChipArea area={nucleo} compacto />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {diaCorto(fechaLocal(nota.fecha), ahora)}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 15, lineHeight: '22px' }}>
            <Box component="span" sx={{ fontWeight: 700 }}>
              Lo que se anotó:{' '}
            </Box>
            «{cita}»
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Se vio: {observadas.map((m) => m.textoObservable).join(' · ')}
          </Typography>
          <Box
            sx={{
              p: 1.25,
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
              bgcolor: colores.verdeSuave,
              color: colores.verdeOscuro,
              borderRadius: '12px',
              fontSize: 15,
              fontWeight: 600,
              lineHeight: '22px',
            }}
          >
            <TipsAndUpdatesRounded sx={{ fontSize: 20, mt: 0.125 }} />
            <Box>
              {tipo === 'tope'
                ? 'Ya mostró lo último de la rúbrica en esta área: sigue ofreciendo desafíos variados.'
                : `${PASO[tipo]} ${sugeridas.map((m) => `«${m.textoObservable}»`).join(' o ')}.`}
            </Box>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
