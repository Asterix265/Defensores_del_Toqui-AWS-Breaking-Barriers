import { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { etiquetaSala, useObservacionesDe } from './api';
import { areasSinNotas, registrosDe, resumenAreas } from './areas';
import { NinoAvatar, Pantalla } from './componentes';
import type { Nino } from './datos';
import { colores } from './tema';

/**
 * Niños y niñas de la sala elegida, con cuántas áreas siguen sin registros en 30 días
 * (observaciones de la API: del dataset y confirmadas en la app).
 * La sala se cambia desde el subtítulo: no suma filas ni controles a la pantalla.
 */
export function MiSala({
  ninos,
  salas,
  salaPropia,
  ahora,
  sala,
  onCambiarSala,
  onAbrir,
}: {
  /** Niños y niñas de todas las salas del jardín. */
  ninos: Nino[];
  salas: string[];
  salaPropia: string;
  ahora: Date;
  sala: string;
  onCambiarSala: (sala: string) => void;
  onAbrir: (ninoId: string) => void;
}) {
  const deLaSala = ninos.filter((n) => n.sala === sala);
  const observaciones = useObservacionesDe(deLaSala.map((n) => n.id));
  const cuantosEn = (s: string) => ninos.filter((n) => n.sala === s).length;
  return (
    <Pantalla>
      <Stack sx={{ px: 2.5, pt: 3, gap: 0.25 }}>
        <Typography variant="h1">Mi sala</Typography>
        <SelectorSala
          sala={sala}
          salas={salas}
          salaPropia={salaPropia}
          cuantosEn={cuantosEn}
          onCambiar={onCambiarSala}
        />
      </Stack>
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, px: 2, pt: 1.5, pb: 3, gap: 1.25 }}>
        {deLaSala.map((nino, i) => {
          const consulta = observaciones[i];
          // Mientras carga no se muestra la cuenta, para no anunciar áreas «sin notas» por error.
          const sinNotas = consulta?.isSuccess
            ? areasSinNotas(resumenAreas(registrosDe(consulta.data), ahora))
            : 0;
          return (
            <li key={nino.id}>
              <ButtonBase
                onClick={() => onAbrir(nino.id)}
                sx={{
                  width: '100%',
                  minHeight: 64,
                  px: 1.75,
                  py: 1.25,
                  gap: 1.5,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  bgcolor: '#fff',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '16px',
                }}
              >
                <NinoAvatar nino={nino} tamano={44} />
                <Box sx={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700 }}>
                  {nino.nombre}
                </Box>
                {sinNotas > 0 && (
                  <Box
                    component="span"
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 999,
                      bgcolor: colores.amarilloSuave,
                      color: colores.amarilloTinta,
                      fontSize: 14,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sinNotas} {sinNotas === 1 ? 'área' : 'áreas'} sin notas
                  </Box>
                )}
                <ChevronRightRounded sx={{ color: 'text.secondary' }} />
              </ButtonBase>
            </li>
          );
        })}
      </Stack>
    </Pantalla>
  );
}

/** Nombre de la sala con un chevron; abre un menú corto con las salas del jardín. */
function SelectorSala({
  sala,
  salas,
  salaPropia,
  cuantosEn,
  onCambiar,
}: {
  sala: string;
  salas: string[];
  salaPropia: string;
  cuantosEn: (sala: string) => number;
  onCambiar: (sala: string) => void;
}) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const cerrar = () => setAncla(null);

  return (
    <>
      <ButtonBase
        onClick={(e) => setAncla(e.currentTarget)}
        aria-label={`${etiquetaSala(sala)}. Cambiar sala`}
        aria-haspopup="menu"
        aria-expanded={ancla !== null}
        aria-controls={ancla ? 'menu-salas' : undefined}
        sx={{
          alignSelf: 'flex-start',
          minHeight: 44,
          ml: -1,
          px: 1,
          gap: 0.25,
          borderRadius: '12px',
          fontSize: 16,
          fontWeight: 700,
          color: 'text.secondary',
          '&:hover': { bgcolor: colores.cremaRosa },
        }}
      >
        {etiquetaSala(sala)}
        <ExpandMoreRounded
          sx={{ transition: 'transform .15s', transform: ancla ? 'rotate(180deg)' : 'none' }}
        />
      </ButtonBase>
      <Menu
        id="menu-salas"
        anchorEl={ancla}
        open={ancla !== null}
        onClose={cerrar}
        slotProps={{ paper: { sx: { borderRadius: '16px', minWidth: 240 } } }}
      >
        {salas.map((s) => {
          const elegida = s === sala;
          return (
            <MenuItem
              key={s}
              selected={elegida}
              onClick={() => {
                onCambiar(s);
                cerrar();
              }}
              sx={{ minHeight: 56, gap: 1.5 }}
            >
              <ListItemText
                primary={etiquetaSala(s)}
                secondary={`${s === salaPropia ? 'Tu sala · ' : ''}${cuantosEn(s)} niños y niñas`}
                slotProps={{
                  primary: { sx: { fontWeight: 700 } },
                  secondary: { sx: { fontSize: 14 } },
                }}
              />
              {elegida && <CheckRounded color="primary" />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
