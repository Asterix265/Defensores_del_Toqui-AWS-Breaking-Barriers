import { useRef, useState, type KeyboardEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import LockOpenRounded from '@mui/icons-material/LockOpenRounded';
import MailRounded from '@mui/icons-material/MailRounded';
import { AvisoVerde, Pantalla } from './componentes';

const LARGO_CODIGO = 6;
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ingreso con correo y código de un solo uso (diseño 1d). En la demo no se envían correos. */
export function Ingreso({ onIngresar }: { onIngresar: (correo: string) => void }) {
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState<'correo' | 'codigo'>('correo');
  const correoValido = CORREO_VALIDO.test(correo.trim());

  if (etapa === 'correo') {
    return (
      <Pantalla>
        <Stack
          component="form"
          sx={{ flex: 1 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (correoValido) setEtapa('codigo');
          }}
        >
          <Box
            sx={{ pt: 5, px: 3, display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 800 }}
          >
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
            Fundación Integra
          </Box>
          <Stack sx={{ pt: 3.5, px: 3, gap: 0.75 }}>
            <Typography variant="h1" sx={{ fontSize: 28, lineHeight: '34px' }}>
              Hola 👋
              <br />
              ¿Cuál es tu correo?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Te enviaremos un código para entrar.
            </Typography>
          </Stack>
          <Box sx={{ pt: 3, px: 3 }}>
            <TextField
              fullWidth
              type="email"
              autoComplete="email"
              placeholder="tu.correo@integra.cl"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              slotProps={{
                htmlInput: { 'aria-label': 'Correo' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailRounded sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  height: 60,
                  bgcolor: '#fff',
                  fontSize: 17,
                  fontWeight: 600,
                },
                '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
              }}
            />
          </Box>
          <Box sx={{ mt: 'auto', px: 3, pt: 2, pb: 4 }}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!correoValido}
              endIcon={<ArrowForwardRounded />}
            >
              Enviar código
            </Button>
          </Box>
        </Stack>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Stack
        component="form"
        sx={{ flex: 1 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (codigo.length === LARGO_CODIGO) onIngresar(correo.trim());
        }}
      >
        <Box sx={{ px: 1.5, pt: 1 }}>
          <IconButton aria-label="Volver" onClick={() => setEtapa('correo')} sx={{ p: 1.25 }}>
            <ArrowBackRounded sx={{ fontSize: 28, color: 'text.primary' }} />
          </IconButton>
        </Box>
        <Stack sx={{ pt: 1.5, px: 3, gap: 0.75 }}>
          <Typography variant="h1" sx={{ fontSize: 28, lineHeight: '34px' }}>
            Revisa tu correo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: '24px' }}>
            Escribe los 6 números que te enviamos a {correo.trim()}
          </Typography>
        </Stack>
        <Box sx={{ pt: 3.5, px: 2.5 }}>
          <CampoCodigo valor={codigo} onCambio={setCodigo} />
        </Box>
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Button variant="text" sx={{ color: 'primary.dark' }} onClick={() => setCodigo('')}>
            No me llegó, enviar otra vez
          </Button>
        </Box>
        <Stack sx={{ px: 3, pt: 1.5, gap: 1.5 }}>
          <AvisoVerde icono={<LockOpenRounded />}>
            Solo lo pedimos una vez. Después la app te recuerda.
          </AvisoVerde>
          <Alert severity="info" sx={{ borderRadius: '14px' }}>
            Modo demo: no se envían correos. Escribe cualquier código de 6 números.
          </Alert>
        </Stack>
        <Box sx={{ mt: 'auto', px: 3, pt: 2, pb: 4 }}>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={codigo.length < LARGO_CODIGO}
          >
            Entrar
          </Button>
        </Box>
      </Stack>
    </Pantalla>
  );
}

/** Seis casillas de un dígito; aceptan escritura, borrado y pegar el código completo. */
function CampoCodigo({ valor, onCambio }: { valor: string; onCambio: (valor: string) => void }) {
  const casillas = useRef<(HTMLInputElement | null)[]>([]);

  const escribir = (indice: number, texto: string) => {
    const digitos = texto.replace(/\D/g, '');
    if (!digitos) return;
    const nuevo = (valor.slice(0, indice) + digitos).slice(0, LARGO_CODIGO);
    onCambio(nuevo);
    casillas.current[Math.min(nuevo.length, LARGO_CODIGO - 1)]?.focus();
  };

  const borrar = (indice: number, e: KeyboardEvent) => {
    if (e.key !== 'Backspace') return;
    e.preventDefault();
    const hasta = valor[indice] ? indice : indice - 1;
    if (hasta < 0) return;
    onCambio(valor.slice(0, hasta));
    casillas.current[hasta]?.focus();
  };

  return (
    <Box
      role="group"
      aria-label="Código de 6 números"
      sx={{ display: 'grid', gridTemplateColumns: `repeat(${LARGO_CODIGO}, 1fr)`, gap: 1 }}
    >
      {Array.from({ length: LARGO_CODIGO }, (_, i) => (
        <InputBase
          key={i}
          inputRef={(el: HTMLInputElement | null) => {
            casillas.current[i] = el;
          }}
          value={valor[i] ?? ''}
          onChange={(e) => escribir(i, e.target.value)}
          onKeyDown={(e) => borrar(i, e)}
          onFocus={(e) => e.target.select()}
          inputProps={{
            'aria-label': `Número ${i + 1} de ${LARGO_CODIGO}`,
            inputMode: 'numeric',
            autoComplete: i === 0 ? 'one-time-code' : 'off',
          }}
          sx={{
            height: 60,
            bgcolor: '#fff',
            border: 1,
            borderColor: 'divider',
            borderRadius: '14px',
            fontSize: 26,
            fontWeight: 800,
            '&.Mui-focused': { border: 2, borderColor: 'primary.main' },
            '& input': { textAlign: 'center', p: 0 },
          }}
        />
      ))}
    </Box>
  );
}
