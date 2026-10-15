import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import { useObservaciones } from './api';
import { DIAS_PERIODO, registrosDe, resumenAreas, type ResumenArea } from './areas';
import { ChipArea, ICONO_DOMINIO, NinoAvatar, Pantalla } from './componentes';
import { COLOR_DOMINIO, ETIQUETA_DOMINIO, type Nino, type Nota } from './datos';
import { diaCorto, formatoCuando } from './formato';
import { colores } from './tema';

const NOTAS_VISIBLES = 3;

const titulo = {
  px: 0.5,
  color: 'text.secondary',
  textTransform: 'uppercase',
} as const;

/**
 * Ficha del niño o niña (diseño B, «áreas primero»): registros por área en los últimos 30 días,
 * con las áreas sin registros primero como sugerencia de observación, y sus últimos registros.
 * Junta las observaciones de la API con las notas guardadas en esta sesión.
 * No muestra niveles ni comparaciones con la edad: cuenta registros, no logros.
 */
export function FichaNino({
  nino,
  notas,
  ahora,
  onVolver,
  onGrabar,
}: {
  nino: Nino;
  notas: Nota[];
  ahora: Date;
  onVolver: () => void;
  /** Graba una nota ya asociada a este niño o niña. */
  onGrabar: () => void;
}) {
  return (
    <Pantalla>
      <Stack sx={{ px: 2, pt: 2, gap: 1.5 }}>
        <ButtonBase
          onClick={onVolver}
          aria-label="Volver a Mi sala"
          sx={{
            alignSelf: 'flex-start',
            minHeight: 44,
            pr: 1,
            borderRadius: '12px',
            fontSize: 16,
            fontWeight: 700,
            color: 'text.secondary',
          }}
        >
          <ChevronLeftRounded />
          Mi sala
        </ButtonBase>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, px: 0.5 }}>
          <NinoAvatar nino={nino} tamano={56} />
          <Typography variant="h1" sx={{ flex: 1 }}>
            {nino.nombre}
          </Typography>
          <IconButton
            aria-label={`Grabar nota de ${nino.nombre}`}
            onClick={onGrabar}
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
              color: '#fff',
              boxShadow: '0 8px 24px -4px rgba(214,40,57,.35)',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <MicRounded sx={{ fontSize: 30 }} />
          </IconButton>
        </Box>
      </Stack>

      <Box sx={{ px: 2, pt: 2.5 }}>
        <AreasNino nino={nino} notas={notas} ahora={ahora} />
      </Box>
      <Box sx={{ px: 2, pt: 3, pb: 3 }}>
        <UltimasNotas
          nino={nino}
          notas={notas}
          ahora={ahora}
          sinNotas="Presiona el micrófono para registrar la primera."
        />
      </Box>
    </Pantalla>
  );
}

/**
 * Áreas del niño o niña en los últimos 30 días: las sin notas apiladas primero (invitación a
 * observar) y las demás en grilla. La comparten la ficha del celular y la de escritorio.
 */
export function AreasNino({ nino, notas, ahora }: { nino: Nino; notas: Nota[]; ahora: Date }) {
  const resumen = resumenAreas(notas, nino.id, ahora);
  const sinNotas = resumen.filter((r) => r.cantidad === 0);
  const conNotas = resumen.filter((r) => r.cantidad > 0);
  return (
    <Stack sx={{ gap: 1.25 }}>
      <Typography variant="h2" sx={titulo}>
        Últimos {DIAS_PERIODO} días
      </Typography>
      {sinNotas.map((r) => (
        <AreaSinNotas key={r.area} resumen={r} />
      ))}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.25 }}>
        {conNotas.map((r) => (
          <AreaConNotas key={r.area} resumen={r} ahora={ahora} />
        ))}
      </Box>
    </Stack>
  );
}

/** Notas del niño o niña, de la más reciente a la más antigua: 3 visibles y «Ver las N». */
export function UltimasNotas({
  nino,
  notas,
  ahora,
  sinNotas,
}: {
  nino: Nino;
  notas: Nota[];
  ahora: Date;
  /** Cómo registrar la primera nota en este dispositivo. */
  sinNotas: string;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const delNino = notas
    .filter((n) => n.ninoId === nino.id)
    .sort((a, b) => b.creada.getTime() - a.creada.getTime());
  const visibles = verTodas ? delNino : delNino.slice(0, NOTAS_VISIBLES);
  return (
    <Stack sx={{ gap: 1.25 }}>
      <Typography variant="h2" sx={titulo}>
        Últimas notas
      </Typography>
      {delNino.length === 0 && (
        <Typography color="text.secondary" sx={{ px: 0.5 }}>
          Aún no hay notas de {nino.nombre}. {sinNotas}
        </Typography>
      )}
      {visibles.map((nota) => (
        <Stack
          key={nota.id}
          component="article"
          sx={{
            p: 1.75,
            gap: 1,
            bgcolor: '#fff',
            border: 1,
            borderColor: 'divider',
            borderRadius: '16px',
          }}
        >
          <Typography sx={{ fontSize: 16, lineHeight: '24px' }}>{nota.texto}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <ChipArea area={nota.area} compacto />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {formatoCuando(nota.creada, ahora)} · Tía {nota.educadora}
            </Typography>
          </Box>
        </Stack>
      ))}
      {!verTodas && delNino.length > NOTAS_VISIBLES && (
        <Button variant="text" onClick={() => setVerTodas(true)}>
          Ver las {delNino.length}
        </Button>
      )}
    </Stack>
  );
}

function IconoArea({ area, tamano }: { area: ResumenArea['area']; tamano: number }) {
  const Icono = ICONO_DOMINIO[area];
  const { fondo, tinta } = COLOR_DOMINIO[area];
  return (
    <Box
      aria-hidden
      sx={{
        width: tamano,
        height: tamano,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: fondo,
        color: tinta,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Icono sx={{ fontSize: Math.round(tamano * 0.55) }} />
    </Box>
  );
}

function AreaSinNotas({ resumen }: { resumen: ResumenArea }) {
  return (
    <Box
      component="section"
      aria-label={ETIQUETA_DOMINIO[resumen.area]}
      sx={{
        px: 2,
        py: 1.75,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: colores.amarilloSuave,
        border: 1,
        borderColor: colores.amarillo,
        borderRadius: '16px',
      }}
    >
      <IconoArea area={resumen.area} tamano={40} />
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800 }}>
          {ETIQUETA_DOMINIO[resumen.area]}
        </Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: colores.amarilloTinta }}>
          Sin notas aún. Buen momento para observar.
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: colores.amarilloTinta }}>
        0
      </Typography>
    </Box>
  );
}

function AreaConNotas({ resumen, ahora }: { resumen: ResumenArea; ahora: Date }) {
  return (
    <Stack
      component="section"
      aria-label={ETIQUETA_DOMINIO[resumen.area]}
      sx={{
        p: 1.75,
        gap: 0.75,
        bgcolor: '#fff',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconoArea area={resumen.area} tamano={36} />
        <Typography sx={{ fontSize: 26, fontWeight: 800 }}>{resumen.cantidad}</Typography>
      </Box>
      <Typography sx={{ fontSize: 17, fontWeight: 800 }}>
        {ETIQUETA_DOMINIO[resumen.area]}
      </Typography>
      {resumen.ultima && (
        <Typography variant="caption" color="text.secondary">
          Última: {diaCorto(resumen.ultima, ahora).toLowerCase()}
        </Typography>
      )}
    </Stack>
  );
}
