import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { ICONO_FORMATO, NinoAvatar } from '../componentes';
import type { Nino } from '../datos';
import { formatoCuando } from '../formato';
import { useNotas, type NotaGuardada } from '../registrar';
import { colores } from '../tema';

/**
 * Notas de la educadora que quedaron sin decidir («Sin revisar» o «Con error»), sobre la tabla
 * de «Mis notas». Cada una abre su revisión. Sin pendientes no muestra nada.
 */
export function PorRevisar({
  ninos,
  ahora,
  onRevisar,
}: {
  ninos: Nino[];
  ahora: Date;
  onRevisar: (capturaId: string) => void;
}) {
  const listas = useNotas(ninos, { mias: 'true', estado: 'borrador_listo' });
  const conError = useNotas(ninos, { mias: 'true', estado: 'error' });
  const pendientes = [...(listas.data ?? []), ...(conError.data ?? [])].sort(
    (a, b) => b.creada.getTime() - a.creada.getTime(),
  );
  if (pendientes.length === 0) return null;

  return (
    <Box component="section" aria-label="Por revisar" sx={{ pt: 3 }}>
      <Typography variant="h2" color="text.secondary" sx={{ pb: 1.25, textTransform: 'uppercase' }}>
        Por revisar · {pendientes.length}
      </Typography>
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 1.25,
        }}
      >
        {pendientes.map((nota) => (
          <li key={nota.id}>
            <TarjetaPendiente nota={nota} ahora={ahora} onClick={() => onRevisar(nota.id)} />
          </li>
        ))}
      </Box>
    </Box>
  );
}

function TarjetaPendiente({
  nota,
  ahora,
  onClick,
}: {
  nota: NotaGuardada;
  ahora: Date;
  onClick: () => void;
}) {
  const Icono = ICONO_FORMATO[nota.formato];
  const conError = nota.estado === 'error';
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`Revisar nota de ${nota.nino.nombre}`}
      sx={{
        width: '100%',
        px: 2,
        py: 1.5,
        gap: 1.5,
        justifyContent: 'flex-start',
        textAlign: 'left',
        bgcolor: colores.amarilloSuave,
        border: 1,
        borderColor: colores.amarillo,
        borderRadius: '16px',
      }}
    >
      <NinoAvatar nino={nota.nino} tamano={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontSize: 16, fontWeight: 700 }}>{nota.nino.nombre}</Box>
        <Box
          sx={{
            fontSize: 15,
            color: 'text.secondary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {nota.texto ?? 'Sin texto'}
        </Box>
        <Box
          sx={{
            mt: 0.25,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: 14,
            fontWeight: 700,
            color: conError ? colores.rojo : colores.amarilloTinta,
          }}
        >
          <Icono sx={{ fontSize: 18 }} />
          {conError ? 'Con error' : 'Sin revisar'} · {formatoCuando(nota.creada, ahora)}
        </Box>
      </Box>
      <ChevronRightRounded sx={{ color: 'text.secondary' }} />
    </ButtonBase>
  );
}
