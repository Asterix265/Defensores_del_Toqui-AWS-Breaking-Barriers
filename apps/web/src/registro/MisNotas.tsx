import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { ChipArea, Encabezado, ICONO_FORMATO, NinoAvatar, Pantalla } from './componentes';
import { etiquetaDia, formatoHora } from './formato';
import type { Nino } from './datos';
import { useNotas, type NotaGuardada } from './registrar';
import { colores } from './tema';

const ESTADO: Record<NotaGuardada['estado'], { texto: string; color: string } | null> = {
  confirmada: { texto: 'Guardada', color: colores.verde },
  borrador_listo: { texto: 'Sin revisar', color: colores.amarilloTinta },
  procesando: { texto: 'Procesando', color: colores.amarilloTinta },
  error: { texto: 'Con error', color: colores.rojo },
  descartada: null,
};

/** Notas que registró la tía (guardadas en la API), agrupadas por día (diseño 1d). */
export function MisNotas({ ninos, ahora }: { ninos: Nino[]; ahora: Date }) {
  const consulta = useNotas(ninos, { mias: 'true' });
  const ordenadas = (consulta.data ?? [])
    .filter((n) => n.estado !== 'descartada')
    .sort((a, b) => b.creada.getTime() - a.creada.getTime());
  const grupos = new Map<string, NotaGuardada[]>();
  for (const nota of ordenadas) {
    const etiqueta = etiquetaDia(nota.creada, ahora);
    grupos.set(etiqueta, [...(grupos.get(etiqueta) ?? []), nota]);
  }

  return (
    <Pantalla>
      <Encabezado titulo="Mis notas" />
      {consulta.isPending && (
        <Typography role="status" color="text.secondary" sx={{ px: 2.5, pt: 2 }}>
          Cargando tus notas…
        </Typography>
      )}
      {consulta.isError && (
        <Typography role="alert" color="error" sx={{ px: 2.5, pt: 2 }}>
          No se pudieron cargar tus notas. Revisa que la API esté levantada.
        </Typography>
      )}
      {consulta.isSuccess && grupos.size === 0 && (
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

function TarjetaNota({ nota }: { nota: NotaGuardada }) {
  const { nino } = nota;
  const estado = ESTADO[nota.estado];
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
        {nota.texto ?? 'Sin texto'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {nota.dominios.map((d) => (
          <ChipArea key={d} area={d} compacto />
        ))}
        {estado && (
          <Box
            sx={{
              ml: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 14,
              fontWeight: 700,
              color: estado.color,
            }}
          >
            {nota.estado === 'confirmada' && <CheckCircleRounded sx={{ fontSize: 20 }} />}
            {estado.texto}
          </Box>
        )}
      </Box>
    </Stack>
  );
}
