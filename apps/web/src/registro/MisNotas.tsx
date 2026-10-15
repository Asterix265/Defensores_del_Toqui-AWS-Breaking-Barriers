import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { ChipArea, Encabezado, ICONO_FORMATO, NinoAvatar, Pantalla } from './componentes';
import { etiquetaDia, formatoHora } from './formato';
import { dominiosDe, type Nota } from './datos';
import { colores } from './tema';

/** Notas que la tía guardó en esta sesión, agrupadas por día (diseño 1d). */
export function MisNotas({ notas, ahora }: { notas: Nota[]; ahora: Date }) {
  const ordenadas = [...notas].sort((a, b) => b.creada.getTime() - a.creada.getTime());
  const grupos = new Map<string, Nota[]>();
  for (const nota of ordenadas) {
    const etiqueta = etiquetaDia(nota.creada, ahora);
    grupos.set(etiqueta, [...(grupos.get(etiqueta) ?? []), nota]);
  }

  return (
    <Pantalla>
      <Encabezado titulo="Mis notas" />
      {grupos.size === 0 && (
        <Typography color="text.secondary" sx={{ px: 2.5, pt: 2 }}>
          Aún no tienes notas. Presiona «Grabar» para hacer la primera.
        </Typography>
      )}
      {[...grupos].map(([etiqueta, delDia]) => (
        <Box component="section" key={etiqueta} aria-label={etiqueta}>
          <Typography
            variant="h2"
            color="text.secondary"
            sx={{ px: 2.5, pt: 2, pb: 1, textTransform: 'uppercase' }}
          >
            {etiqueta}
          </Typography>
          <Stack sx={{ px: 2, gap: 1.25 }}>
            {delDia.map((nota) => (
              <TarjetaNota key={nota.id} nota={nota} />
            ))}
          </Stack>
        </Box>
      ))}
      <Box sx={{ height: 24 }} />
    </Pantalla>
  );
}

function TarjetaNota({ nota }: { nota: Nota }) {
  const { nino } = nota;
  const Icono = ICONO_FORMATO[nota.formato];
  return (
    <Stack
      component="article"
      sx={{
        p: 1.75,
        gap: 1.25,
        bgcolor: '#fff',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <NinoAvatar nino={nino} />
        <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{nino.nombre}</Typography>
        <Box
          sx={{
            ml: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: 14,
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          <Icono sx={{ fontSize: 20 }} />
          {formatoHora(nota.creada)}
        </Box>
      </Box>
      <Typography
        sx={{
          fontSize: 16,
          lineHeight: '24px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {nota.texto}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {dominiosDe(nota.manifestaciones).map((d) => (
          <ChipArea key={d} area={d} compacto />
        ))}
        <Box
          sx={{
            ml: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: 14,
            fontWeight: 700,
            color: colores.verde,
          }}
        >
          <CheckCircleRounded sx={{ fontSize: 20 }} />
          Guardada
        </Box>
      </Box>
    </Stack>
  );
}
