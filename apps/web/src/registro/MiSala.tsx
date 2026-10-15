import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { areasSinNotas, resumenAreas } from './areas';
import { Encabezado, NinoAvatar, Pantalla } from './componentes';
import { NINOS_DE_MI_SALA, SALA, type Nota } from './datos';
import { colores } from './tema';

/** Niños y niñas de la sala de la tía, con cuántas áreas siguen sin notas en 30 días. */
export function MiSala({
  notas,
  ahora,
  onAbrir,
}: {
  notas: Nota[];
  ahora: Date;
  onAbrir: (ninoId: string) => void;
}) {
  return (
    <Pantalla>
      <Encabezado titulo="Mi sala" subtitulo={SALA} />
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, px: 2, pt: 2, pb: 3, gap: 1.25 }}>
        {NINOS_DE_MI_SALA.map((nino) => {
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
