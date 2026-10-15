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
import { areasSinNotas, resumenAreas } from './areas';
import { NinoAvatar, Pantalla } from './componentes';
import { SALA, SALAS, ninosDeSala, type Nota } from './datos';
import { colores } from './tema';

/**
 * Niños y niñas de la sala elegida, con cuántas áreas siguen sin notas en 30 días.
 * La sala se cambia desde el subtítulo: no suma filas ni controles a la pantalla.
 */
export function MiSala({
  notas,
  ahora,
  sala,
  onCambiarSala,
  onAbrir,
}: {
  notas: Nota[];
  ahora: Date;
  sala: string;
  onCambiarSala: (sala: string) => void;
  onAbrir: (ninoId: string) => void;
}) {
  return (
    <Pantalla>
      <Stack sx={{ px: 2.5, pt: 3, gap: 0.25 }}>
        <Typography variant="h1">Mi sala</Typography>
        <SelectorSala sala={sala} onCambiar={onCambiarSala} />
      </Stack>
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, px: 2, pt: 1.5, pb: 3, gap: 1.25 }}>
        {ninosDeSala(sala).map((nino) => {
          const sinNotas = areasSinNotas(resumenAreas(notas, nino.id, ahora));
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
function SelectorSala({ sala, onCambiar }: { sala: string; onCambiar: (sala: string) => void }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const cerrar = () => setAncla(null);

  return (
    <>
      <ButtonBase
        onClick={(e) => setAncla(e.currentTarget)}
        aria-label={`${sala}. Cambiar sala`}
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
        {sala}
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
        {SALAS.map((s) => {
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
                primary={s}
                secondary={`${s === SALA ? 'Tu sala · ' : ''}${ninosDeSala(s).length} niños y niñas`}
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
