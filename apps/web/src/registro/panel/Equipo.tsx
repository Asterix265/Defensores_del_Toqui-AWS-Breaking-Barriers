import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PersonAddRounded from '@mui/icons-material/PersonAddRounded';
import { ErrorApi } from '../api';
import { useAccionesCuentas, useCuentas, type Cuenta } from '../estado';
import { colores } from '../tema';
import { TituloVista } from './TituloVista';

const ESTADO: Record<Cuenta['estado'], { texto: string; fondo: string; tinta: string }> = {
  activa: { texto: 'Activa', fondo: colores.verdeSuave, tinta: colores.verdeOscuro },
  pendiente: {
    texto: 'Invitación enviada',
    fondo: colores.amarilloSuave,
    tinta: colores.amarilloTinta,
  },
  desactivada: { texto: 'Desactivada', fondo: colores.lienzo, tinta: colores.textoSuave },
};

const GRUPO: Record<string, string> = { educadora: 'Educadora', directora: 'Directora' };

/**
 * Pestaña «Equipo» de la directora (panel-directora-y-aprendizaje, D5): cuentas de su jardín,
 * invitar a una persona (Cognito envía la contraseña temporal por correo), reenviar la invitación
 * y desactivar o reactivar. No hay autorregistro.
 */
export function Equipo({ idUsuario }: { idUsuario: string }) {
  const cuentas = useCuentas();
  const acciones = useAccionesCuentas();
  const [invitando, setInvitando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const ejecutar = async (accion: Promise<unknown>, exito: string) => {
    setAviso(null);
    try {
      await accion;
      setAviso({ tipo: 'success', texto: exito });
    } catch (error) {
      setAviso({ tipo: 'error', texto: (error as Error).message });
    }
  };

  const sinCognito = cuentas.error instanceof ErrorApi && cuentas.error.status === 501;

  return (
    <>
      <TituloVista titulo="Equipo" subtitulo="Cuentas de tu jardín · solo tú puedes administrarlas">
        <Button
          variant="contained"
          startIcon={<PersonAddRounded />}
          onClick={() => setInvitando(true)}
          disabled={sinCognito}
          sx={{ minHeight: 52, px: 3, fontSize: 17 }}
        >
          Invitar
        </Button>
      </TituloVista>

      {aviso && (
        <Alert
          severity={aviso.tipo}
          sx={{ mt: 2.5, borderRadius: '14px' }}
          onClose={() => setAviso(null)}
        >
          {aviso.texto}
        </Alert>
      )}
      {sinCognito && (
        <Alert severity="info" sx={{ mt: 2.5, borderRadius: '14px' }}>
          En el modo local de prueba no hay cuentas que administrar: se requiere Cognito.
        </Alert>
      )}
      {cuentas.isError && !sinCognito && (
        <Alert severity="error" sx={{ mt: 2.5, borderRadius: '14px' }}>
          No se pudieron cargar las cuentas.
        </Alert>
      )}
      {cuentas.isPending && (
        <Box role="status" sx={{ pt: 3, display: 'flex', gap: 1.5 }}>
          <CircularProgress size={22} aria-hidden />
          <Typography variant="body2">Cargando cuentas…</Typography>
        </Box>
      )}

      {cuentas.data && (
        <Box
          component="ul"
          aria-label="Cuentas del jardín"
          sx={{ listStyle: 'none', m: 0, p: 0, pt: 3, display: 'grid', gap: 1.25 }}
        >
          {cuentas.data.map((c) => {
            const estado = ESTADO[c.estado];
            const propia = c.usuario === idUsuario;
            return (
              <Box
                component="li"
                key={c.usuario}
                sx={{
                  p: 2,
                  bgcolor: '#fff',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography sx={{ fontSize: 17, fontWeight: 800, overflowWrap: 'anywhere' }}>
                    {c.nombre ?? c.email}
                    {propia && ' (tú)'}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {c.email} · {c.grupo ? GRUPO[c.grupo] : 'Sin rol'}
                  </Typography>
                </Box>
                <Box
                  component="span"
                  sx={{
                    px: 1.25,
                    py: 0.25,
                    borderRadius: 999,
                    bgcolor: estado.fondo,
                    color: estado.tinta,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {estado.texto}
                </Box>
                {c.estado === 'pendiente' && (
                  <Button
                    variant="text"
                    onClick={() =>
                      ejecutar(
                        acciones.reenviar.mutateAsync(c.usuario),
                        `Invitación reenviada a ${c.email}`,
                      )
                    }
                  >
                    Reenviar
                  </Button>
                )}
                {c.estado === 'desactivada' ? (
                  <Button
                    variant="text"
                    onClick={() =>
                      ejecutar(
                        acciones.activar.mutateAsync(c.usuario),
                        `${c.email} puede volver a ingresar`,
                      )
                    }
                  >
                    Reactivar
                  </Button>
                ) : (
                  !propia && (
                    <Button
                      variant="text"
                      color="inherit"
                      onClick={() =>
                        ejecutar(
                          acciones.desactivar.mutateAsync(c.usuario),
                          `${c.email} ya no puede ingresar`,
                        )
                      }
                    >
                      Desactivar
                    </Button>
                  )
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <DialogoInvitar
        abierto={invitando}
        onCerrar={() => setInvitando(false)}
        onInvitar={async (datos) => {
          await acciones.invitar.mutateAsync(datos);
          setInvitando(false);
          setAviso({
            tipo: 'success',
            texto: `Invitación enviada a ${datos.email}. Recibirá una contraseña temporal por correo.`,
          });
        }}
      />
    </>
  );
}

function DialogoInvitar({
  abierto,
  onCerrar,
  onInvitar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onInvitar: (datos: {
    email: string;
    nombre: string;
    grupo: 'educadora' | 'directora';
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [grupo, setGrupo] = useState<'educadora' | 'directora'>('educadora');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onInvitar({ email: email.trim(), nombre: nombre.trim(), grupo });
      setEmail('');
      setNombre('');
      setGrupo('educadora');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open={abierto}
      onClose={onCerrar}
      fullWidth
      maxWidth="xs"
      aria-labelledby="titulo-invitar"
      slotProps={{ paper: { component: 'form', onSubmit: enviar, sx: { borderRadius: '24px' } } }}
    >
      <DialogTitle id="titulo-invitar" sx={{ fontWeight: 800 }}>
        Invitar a tu jardín
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        <TextField
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          slotProps={{ htmlInput: { minLength: 2, maxLength: 80 } }}
        />
        <TextField
          label="Correo"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          select
          label="Rol"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value as typeof grupo)}
        >
          <MenuItem value="educadora">Educadora (registra notas)</MenuItem>
          <MenuItem value="directora">Directora (ve el jardín y administra cuentas)</MenuItem>
        </TextField>
        <Typography variant="caption" color="text.secondary">
          Le llegará un correo con una contraseña temporal. Al ingresar, la app le pedirá crear una
          nueva.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ borderRadius: '14px' }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="text" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="submit" variant="contained" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar invitación'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
