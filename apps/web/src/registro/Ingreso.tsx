import { useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LockRounded from '@mui/icons-material/LockRounded';
import MailRounded from '@mui/icons-material/MailRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import type { ErrorIngreso } from '../auth/sesion';
import { colores } from './tema';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAJE_ERROR: Record<ErrorIngreso, string> = {
  credenciales: 'Correo o contraseña incorrectos.',
  nueva_clave:
    'Tu cuenta tiene una contraseña temporal. Pide a quien administra la app que la deje definitiva.',
  restablecer: 'Debes restablecer tu contraseña. Pide ayuda a quien administra la app.',
  demasiados_intentos: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  red: 'No hay conexión. Revisa tu internet y vuelve a intentarlo.',
  desconocido: 'No se pudo ingresar. Vuelve a intentarlo.',
};

/**
 * Ingreso con correo y contraseña. En el celular ocupa la pantalla (diseño 1d); en pantallas
 * anchas muestra la marca a la izquierda y el formulario en una tarjeta.
 * `onIngresar` devuelve el error o `null` si entró.
 */
export function Ingreso({
  onIngresar,
  aviso,
  modoLocal = false,
}: {
  onIngresar: (correo: string, clave: string) => Promise<ErrorIngreso | null>;
  /** Motivo por el que se volvió al ingreso (sesión terminada, cuenta sin jardín). */
  aviso?: string | null;
  modoLocal?: boolean;
}) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorIngreso | null>(null);
  const listo = CORREO_VALIDO.test(correo.trim()) && clave.length > 0 && !enviando;

  const enviar = async () => {
    if (!listo) return;
    setEnviando(true);
    setError(null);
    const resultado = await onIngresar(correo.trim(), clave);
    // Si entró, este componente se desmonta; solo se actualiza si sigue en pantalla.
    if (resultado) {
      setError(resultado);
      setClave('');
      setEnviando(false);
    }
  };

  const campo = {
    '& .MuiOutlinedInput-root': { height: 60, bgcolor: '#fff', fontSize: 17, fontWeight: 600 },
    '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: { xs: 'background.default', md: colores.lienzo },
        display: 'flex',
        alignItems: { md: 'center' },
        justifyContent: 'center',
        p: { md: 4 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: { xs: 480, md: 960 },
          minHeight: { xs: '100dvh', md: 560 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          bgcolor: 'background.default',
          borderRadius: { md: '28px' },
          overflow: 'hidden',
          boxShadow: { sm: '0 8px 20px -4px rgba(58,36,20,.10)' },
        }}
      >
        <Marca />
        <Stack
          component="form"
          noValidate
          aria-label="Ingreso"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
          sx={{ px: { xs: 3, md: 6 }, pt: { xs: 5, md: 7 }, pb: 4 }}
        >
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: 1.25,
              fontWeight: 800,
            }}
          >
            <Punto />
            Fundación Integra
          </Box>
          <Stack sx={{ pt: { xs: 3.5, md: 0 }, gap: 0.75 }}>
            <Typography variant="h1" sx={{ fontSize: 28, lineHeight: '34px' }}>
              Hola 👋
              <br />
              Ingresa a Registro Simple
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Con el correo y la contraseña de tu cuenta.
            </Typography>
          </Stack>

          <Stack sx={{ pt: 3, gap: 2 }}>
            {aviso && <Alert severity="warning">{aviso}</Alert>}
            <TextField
              fullWidth
              type="email"
              name="username"
              autoComplete="username"
              placeholder="tu.correo@integra.cl"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              disabled={enviando}
              slotProps={{
                htmlInput: { 'aria-label': 'Correo', inputMode: 'email' },
                input: { startAdornment: <Icono>{<MailRounded />}</Icono> },
              }}
              sx={campo}
            />
            <TextField
              fullWidth
              type={verClave ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              disabled={enviando}
              slotProps={{
                htmlInput: { 'aria-label': 'Contraseña' },
                input: {
                  startAdornment: <Icono>{<LockRounded />}</Icono>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        onClick={() => setVerClave((v) => !v)}
                        edge="end"
                      >
                        {verClave ? <VisibilityOffRounded /> : <VisibilityRounded />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={campo}
            />
            {error && (
              <Alert severity="error" role="alert">
                {MENSAJE_ERROR[error]}
              </Alert>
            )}
            {modoLocal && (
              <Alert severity="info">
                Modo local: sin Cognito configurado. Cualquier contraseña sirve y la API debe correr
                con AUTH_MODE=local.
              </Alert>
            )}
          </Stack>

          <Box sx={{ mt: { xs: 'auto', md: 4 }, pt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!listo}
              startIcon={enviando ? <CircularProgress size={22} color="inherit" /> : undefined}
            >
              {enviando ? 'Ingresando…' : 'Entrar'}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

function Punto() {
  return <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />;
}

function Icono({ children }: { children: ReactNode }) {
  return (
    <InputAdornment position="start" sx={{ color: 'text.secondary' }}>
      {children}
    </InputAdornment>
  );
}

/** Columna de marca, solo en pantallas anchas. */
function Marca() {
  return (
    <Stack
      aria-hidden
      sx={{
        display: { xs: 'none', md: 'flex' },
        bgcolor: colores.rojo,
        color: '#fff',
        p: 6,
        gap: 2,
        justifyContent: 'space-between',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 800 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#fff' }} />
        Fundación Integra
      </Box>
      <Stack sx={{ gap: 1.5 }}>
        <Typography sx={{ fontSize: 34, lineHeight: '40px', fontWeight: 800 }}>
          Registro Simple
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 600, opacity: 0.9 }}>
          Graba, fotografía o escribe lo que observas. Nosotros lo ordenamos por área.
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>
        Datos sintéticos de demostración.
      </Typography>
    </Stack>
  );
}
