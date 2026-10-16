import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { BarraInferior } from './BarraInferior';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import {
  alTerminarSesion,
  cerrarSesion,
  haySesion,
  iniciarSesion,
  modoLocal,
} from '../auth/sesion';
import type { MeResponseDtoOutput } from '../api/generated/model';
import { ErrorApi, useCatalogo, useIdentidad, useNinos } from './api';
import type { Formato, Nino } from './datos';
import { FichaNino } from './FichaNino';
import { Ingreso } from './Ingreso';
import { Inicio } from './Inicio';
import { MiSala } from './MiSala';
import { MisNotas } from './MisNotas';
import { NuevaNota } from './NuevaNota';
import { PanelSalas } from './PanelSalas';
import { useNotas } from './registrar';
import { colores } from './tema';

/** Sala de la educadora: el token no la trae, así que se recuerda en el dispositivo. */
const CLAVE_SALA = 'toqui.registro.sala';
/** Correo del ingreso simulado anterior; se borra al cerrar sesión. */
const CLAVE_CORREO_ANTERIOR = 'toqui.registro.correo';

export const AVISO_SESION_TERMINADA = 'Tu sesión terminó. Ingresa de nuevo.';
export const AVISO_SIN_JARDIN =
  'Tu cuenta no tiene un jardín o un rol asignado. Pide ayuda a quien administra la app.';

/**
 * Pantalla del celular. El niño o niña elegido viaja solo en la vista `nueva` abierta desde su
 * ficha: no hay un «niño actual» global que Grabar de la barra pueda heredar.
 */
type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'notas' }
  | { tipo: 'sala' }
  | { tipo: 'ficha'; ninoId: string }
  | { tipo: 'nueva'; formato: Formato; ninoId?: string };

type EstadoSesion = 'verificando' | 'fuera' | 'dentro';

function olvidar(...claves: string[]) {
  try {
    for (const clave of claves) localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

function leerSala(): string | null {
  try {
    return localStorage.getItem(CLAVE_SALA);
  } catch {
    return null;
  }
}

/** «Mercedes Soto» → «Mercedes»; sin nombre, «mercedes.soto@integra.cl» → «Mercedes». */
export function nombreVisible(me: Pick<MeResponseDtoOutput, 'nombre' | 'email'>): string {
  // `||` y no `??`: un nombre vacío también pasa al correo.
  const base =
    me.nombre?.trim().split(/\s+/)[0] || me.email?.split('@')[0]?.split(/[._-]/)[0] || '';
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'tía';
}

function esHoy(fecha: Date, ahora: Date): boolean {
  return fecha.toDateString() === ahora.toDateString();
}

function Marco({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: colores.lienzo }}>
      <Box
        sx={{
          maxWidth: 480,
          mx: 'auto',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          boxShadow: { sm: '0 8px 20px -4px rgba(58,36,20,.10)' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

const marco = (contenido: ReactNode) => <Marco>{contenido}</Marco>;

/**
 * App «Registro Simple». Primero el ingreso con Cognito (o el modo local sin Cognito); con
 * sesión, en el celular el flujo de la tía (diseño 1b + pantallas comunes 1d) y en pantallas
 * anchas el panel de notas de las salas (diseño 1e).
 * Identidad, niños, niñas, catálogo, niveles, registros y notas vienen de la API con el ID token;
 * el audio y la foto se suben a S3. La transcripción, la lectura de la foto y la IA aún no están
 * implementadas en la API (la revisión lo avisa).
 */
export function RegistroApp() {
  const [estado, setEstado] = useState<EstadoSesion>('verificando');
  const [aviso, setAviso] = useState<string | null>(null);
  const cliente = useQueryClient();
  /** Evita cerrar la sesión varias veces cuando llegan varios 401 a la vez. */
  const cerrando = useRef(false);

  useEffect(() => {
    let vigente = true;
    void haySesion().then((hay) => {
      if (vigente) setEstado(hay ? 'dentro' : 'fuera');
    });
    return () => {
      vigente = false;
    };
  }, []);

  /** Revoca la sesión del dispositivo y borra lo que quedó del jardín en memoria. */
  const salir = useCallback(
    async (motivo: string | null) => {
      if (cerrando.current) return;
      cerrando.current = true;
      try {
        await cerrarSesion();
        cliente.clear();
        olvidar(CLAVE_SALA, CLAVE_CORREO_ANTERIOR);
        setAviso(motivo);
        setEstado('fuera');
      } finally {
        cerrando.current = false;
      }
    },
    [cliente],
  );

  // La API rechazó el token (vencido, revocado o de otro pool).
  useEffect(() => alTerminarSesion(() => void salir(AVISO_SESION_TERMINADA)), [salir]);

  if (estado === 'verificando') return marco(<Estado mensaje="Abriendo…" cargando />);
  if (estado === 'fuera') {
    return (
      <Ingreso
        aviso={aviso}
        modoLocal={modoLocal()}
        onIngresar={async (correo, clave) => {
          const resultado = await iniciarSesion(correo, clave);
          if (!resultado.ok) return resultado.error;
          setAviso(null);
          setEstado('dentro');
          return null;
        }}
      />
    );
  }
  return <AppSesion salir={salir} />;
}

/** Con sesión: identidad y datos del jardín, y la confirmación para cerrar sesión. */
function AppSesion({ salir }: { salir: (motivo: string | null) => Promise<void> }) {
  const identidad = useIdentidad();
  const ninos = useNinos();
  const catalogo = useCatalogo();
  const escritorio = useMediaQuery(useTheme().breakpoints.up('md'));
  const [confirmando, setConfirmando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const sinPermiso = identidad.error instanceof ErrorApi && identidad.error.status === 403;

  useEffect(() => {
    if (sinPermiso) void salir(AVISO_SIN_JARDIN);
  }, [sinPermiso, salir]);

  const pedirSalida = () => setConfirmando(true);
  const confirmacion = (
    <Dialog
      open={confirmando}
      onClose={() => !saliendo && setConfirmando(false)}
      aria-labelledby="titulo-salir"
      aria-describedby="detalle-salir"
    >
      <DialogTitle id="titulo-salir" sx={{ fontWeight: 800 }}>
        ¿Cerrar sesión?
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="detalle-salir">
          Tus notas guardadas no se pierden. Para volver a entrar en este dispositivo necesitarás tu
          correo y contraseña.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="text" onClick={() => setConfirmando(false)} disabled={saliendo}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={saliendo}
          onClick={() => {
            setSaliendo(true);
            void salir(null);
          }}
        >
          Cerrar sesión
        </Button>
      </DialogActions>
    </Dialog>
  );

  let pantalla;
  if (sinPermiso) {
    pantalla = marco(<Estado mensaje="Cerrando sesión…" cargando />);
  } else if (identidad.isError || ninos.isError || catalogo.isError) {
    pantalla = marco(
      <Estado
        mensaje="No se pudo conectar con la API. Revisa que esté levantada (pnpm dev)."
        onReintentar={() => window.location.reload()}
        onSalir={pedirSalida}
      />,
    );
  } else if (!identidad.data || !ninos.data || !catalogo.niveles || !catalogo.manifestaciones) {
    pantalla = marco(<Estado mensaje="Cargando tu jardín…" cargando />);
  } else {
    pantalla = (
      <AppConDatos
        nombre={nombreVisible(identidad.data)}
        ninos={ninos.data}
        catalogo={{ niveles: catalogo.niveles, manifestaciones: catalogo.manifestaciones }}
        escritorio={escritorio}
        marco={marco}
        onSalir={pedirSalida}
      />
    );
  }
  return (
    <>
      {pantalla}
      {confirmacion}
    </>
  );
}

function Estado({
  mensaje,
  cargando = false,
  onReintentar,
  onSalir,
}: {
  mensaje: string;
  cargando?: boolean;
  onReintentar?: () => void;
  onSalir?: () => void;
}) {
  return (
    <Box
      role={cargando ? 'status' : 'alert'}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 3,
        textAlign: 'center',
      }}
    >
      {cargando && <CircularProgress aria-hidden />}
      <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{mensaje}</Typography>
      {onReintentar && (
        <Button variant="contained" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
      {onSalir && (
        <Button variant="text" onClick={onSalir}>
          Cerrar sesión
        </Button>
      )}
    </Box>
  );
}

function AppConDatos({
  nombre,
  ninos,
  catalogo,
  escritorio,
  marco,
  onSalir,
}: {
  nombre: string;
  ninos: Nino[];
  catalogo: ComponentProps<typeof NuevaNota>['catalogo'];
  escritorio: boolean;
  marco: (contenido: ReactNode) => ReactNode;
  onSalir: () => void;
}) {
  const salas = [...new Set(ninos.map((n) => n.sala))].sort();
  const guardada = leerSala();
  const salaPropia = guardada && salas.includes(guardada) ? guardada : (salas[0] ?? '');
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });
  const [aviso, setAviso] = useState<string | null>(null);
  // Sala que se consulta en «Mi sala». Queda fuera de `Vista`: Grabar de la barra no la hereda.
  const [salaVista, setSalaVista] = useState(salaPropia);
  const deMiSala = ninos.filter((n) => n.sala === salaPropia);
  const confirmadas = useNotas(ninos, { mias: 'true', estado: 'confirmada' });

  const ahora = new Date();
  const nueva = (formato: Formato) => setVista({ tipo: 'nueva', formato });
  const alGuardar = (nino: Nino) => setAviso(`Nota guardada para ${nino.nombre}`);

  const avisoGuardado = (
    <Snackbar
      open={aviso !== null}
      autoHideDuration={3000}
      onClose={() => setAviso(null)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity="success" variant="filled" sx={{ fontSize: 16, fontWeight: 700 }}>
        {aviso}
      </Alert>
    </Snackbar>
  );

  if (escritorio) {
    return (
      <>
        <PanelSalas
          ninos={ninos}
          salas={salas}
          salaPropia={salaPropia}
          catalogo={catalogo}
          ahora={ahora}
          nombre={nombre}
          onGuardada={alGuardar}
          onSalir={onSalir}
        />
        {avisoGuardado}
      </>
    );
  }

  let contenido;
  if (vista.tipo === 'nueva') {
    const { ninoId } = vista;
    const volver = () => setVista(ninoId ? { tipo: 'ficha', ninoId } : { tipo: 'inicio' });
    contenido = (
      <NuevaNota
        formato={vista.formato}
        ninos={deMiSala}
        // Desde la ficha puede venir un niño o niña de otra sala.
        ninoFijo={ninos.find((n) => n.id === ninoId)}
        catalogo={catalogo}
        onCancelar={volver}
        onGuardada={(nino) => {
          alGuardar(nino);
          volver();
        }}
      />
    );
  } else {
    const fichaDe = vista.tipo === 'ficha' ? ninos.find((n) => n.id === vista.ninoId) : undefined;
    let pantalla;
    if (fichaDe) {
      pantalla = (
        <FichaNino
          nino={fichaDe}
          ahora={ahora}
          onVolver={() => setVista({ tipo: 'sala' })}
          onGrabar={() => setVista({ tipo: 'nueva', formato: 'audio', ninoId: fichaDe.id })}
        />
      );
    } else if (vista.tipo === 'sala' || vista.tipo === 'ficha') {
      pantalla = (
        <MiSala
          ninos={ninos}
          salas={salas}
          salaPropia={salaPropia}
          ahora={ahora}
          sala={salaVista}
          onCambiarSala={setSalaVista}
          onAbrir={(ninoId) => setVista({ tipo: 'ficha', ninoId })}
        />
      );
    } else if (vista.tipo === 'notas') {
      pantalla = <MisNotas ninos={ninos} ahora={ahora} />;
    } else {
      pantalla = (
        <Inicio
          nombre={nombre}
          notasHoy={(confirmadas.data ?? []).filter((n) => esHoy(n.creada, ahora)).length}
          onElegir={nueva}
          onSalir={onSalir}
        />
      );
    }
    contenido = (
      <>
        {pantalla}
        <BarraInferior
          activa={vista.tipo === 'ficha' ? 'sala' : vista.tipo}
          onInicio={() => setVista({ tipo: 'inicio' })}
          onSala={() => setVista({ tipo: 'sala' })}
          onGrabar={() => nueva('audio')}
          onNotas={() => setVista({ tipo: 'notas' })}
        />
      </>
    );
  }

  return (
    <>
      {marco(contenido)}
      {avisoGuardado}
    </>
  );
}
