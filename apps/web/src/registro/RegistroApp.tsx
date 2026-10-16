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
import { esSinPermiso, ordenarSalas, useCatalogo, useIdentidad, useNinos } from './api';
import type { Formato, Nino } from './datos';
import { FichaNino } from './FichaNino';
import { Ingreso } from './Ingreso';
import { Inicio } from './Inicio';
import { MiSala } from './MiSala';
import { MisNotas } from './MisNotas';
import { useVistaConHistorial } from './historial';
import { NuevaNota, RevisarCaptura } from './NuevaNota';
import { PanelSalas } from './PanelSalas';
import { useNotas } from './registrar';
import { useSalidaNota } from './salida';
import { colores } from './tema';

/** Sala de la educadora: el token no la trae, así que se recuerda en el dispositivo. */
const CLAVE_SALA = 'toqui.registro.sala';
/** Correo del ingreso simulado anterior; se borra al cerrar sesión. */
const CLAVE_CORREO_ANTERIOR = 'toqui.registro.correo';

export const AVISO_SESION_TERMINADA = 'Tu sesión terminó. Ingresa de nuevo.';
/** Sin «pnpm dev»: el mensaje también se ve en producción. */
export const MENSAJE_SIN_API =
  'No se pudo conectar con la API. Revisa tu conexión y vuelve a intentarlo.';
export const AVISO_SIN_JARDIN =
  'Tu cuenta no tiene un jardín o un rol asignado. Pide ayuda a quien administra la app.';

/**
 * Pantalla del celular, guardada en el historial del navegador para que Atrás vuelva dentro de
 * la app. El niño o niña elegido viaja solo en la vista `nueva` abierta desde su ficha: no hay
 * un «niño actual» global que Grabar de la barra pueda heredar. `revisar` abre una nota
 * «Sin revisar» desde «Mis notas».
 */
type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'notas' }
  | { tipo: 'sala' }
  | { tipo: 'ficha'; ninoId: string }
  | { tipo: 'nueva'; formato: Formato; ninoId?: string }
  | { tipo: 'revisar'; capturaId: string };

const INICIO: Vista = { tipo: 'inicio' };

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
  /**
   * Cierre en curso o terminado. Queda activo hasta el próximo ingreso: los 401 de peticiones que
   * todavía estaban en vuelo no vuelven a cerrar la sesión ni cambian el aviso.
   */
  const cerrando = useRef(false);
  /** Revocación en Cognito en curso; el próximo ingreso la espera para no perder sus tokens. */
  const cierre = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let vigente = true;
    void haySesion().then((hay) => {
      if (vigente) setEstado(hay ? 'dentro' : 'fuera');
    });
    return () => {
      vigente = false;
    };
  }, []);

  /**
   * Cierra la sesión: primero quita la app de la pantalla (ninguna consulta nueva), cancela las
   * peticiones en curso y borra lo que quedó del jardín en memoria; después revoca el refresh
   * token del dispositivo en Cognito.
   */
  const salir = useCallback(
    (motivo: string | null) => {
      if (cerrando.current) return;
      cerrando.current = true;
      setAviso(motivo);
      setEstado('fuera');
      cierre.current = (async () => {
        await cliente.cancelQueries();
        cliente.clear();
        olvidar(CLAVE_SALA, CLAVE_CORREO_ANTERIOR);
        await cerrarSesion();
      })();
    },
    [cliente],
  );

  // La API rechazó el token (vencido, revocado o de otro pool).
  useEffect(() => alTerminarSesion(() => salir(AVISO_SESION_TERMINADA)), [salir]);

  if (estado === 'verificando') {
    return (
      <Marco>
        <Estado mensaje="Abriendo…" cargando />
      </Marco>
    );
  }
  if (estado === 'fuera') {
    return (
      <Ingreso
        aviso={aviso}
        modoLocal={modoLocal()}
        onIngresar={async (correo, clave) => {
          // Si la revocación anterior sigue en curso, terminaría borrando los tokens nuevos.
          await cierre.current;
          const resultado = await iniciarSesion(correo, clave);
          if (!resultado.ok) return resultado.error;
          cerrando.current = false;
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
function AppSesion({ salir }: { salir: (motivo: string | null) => void }) {
  const identidad = useIdentidad();
  const ninos = useNinos();
  const catalogo = useCatalogo();
  const escritorio = useMediaQuery(useTheme().breakpoints.up('md'));
  const [confirmando, setConfirmando] = useState(false);
  // Cualquier 403 (identidad, niños o catálogo) significa que el token no trae grupo o jardín.
  const sinPermiso = [identidad.error, ninos.error, catalogo.error].some(esSinPermiso);

  useEffect(() => {
    if (sinPermiso) salir(AVISO_SIN_JARDIN);
  }, [sinPermiso, salir]);

  const pedirSalida = () => setConfirmando(true);
  const confirmacion = (
    <Dialog
      open={confirmando}
      onClose={() => setConfirmando(false)}
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
        <Button variant="text" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          // Cambia de pantalla al instante: el diálogo no espera a Cognito.
          onClick={() => salir(null)}
        >
          Cerrar sesión
        </Button>
      </DialogActions>
    </Dialog>
  );

  let pantalla;
  if (sinPermiso) {
    pantalla = (
      <Marco>
        <Estado mensaje="Cerrando sesión…" cargando />
      </Marco>
    );
  } else if (identidad.isError || ninos.isError || catalogo.isError) {
    pantalla = (
      <Marco>
        <Estado
          mensaje={MENSAJE_SIN_API}
          onReintentar={() => window.location.reload()}
          onSalir={pedirSalida}
        />
      </Marco>
    );
  } else if (!identidad.data || !ninos.data || !catalogo.niveles || !catalogo.manifestaciones) {
    pantalla = (
      <Marco>
        <Estado mensaje="Cargando tu jardín…" cargando />
      </Marco>
    );
  } else {
    pantalla = (
      <AppConDatos
        nombre={nombreVisible(identidad.data)}
        ninos={ninos.data}
        catalogo={{ niveles: catalogo.niveles, manifestaciones: catalogo.manifestaciones }}
        escritorio={escritorio}
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
  onSalir,
}: {
  nombre: string;
  ninos: Nino[];
  catalogo: ComponentProps<typeof NuevaNota>['catalogo'];
  escritorio: boolean;
  onSalir: () => void;
}) {
  const salas = ordenarSalas([...new Set(ninos.map((n) => n.sala))]);
  const guardada = leerSala();
  const salaPropia = guardada && salas.includes(guardada) ? guardada : (salas[0] ?? '');
  const salida = useSalidaNota();
  const { vista, ir, volver } = useVistaConHistorial<Vista>({
    clave: 'celular',
    inicial: INICIO,
    // En pantallas anchas el historial lo maneja el panel.
    activo: !escritorio,
    // Adelante no rearma una nota a medio hacer (volvería a abrir el micrófono).
    restaurable: (v) => v.tipo !== 'nueva',
    interceptar: () => {
      if (!salida.hayEnCurso()) return false;
      salida.pedir(() => volver());
      return true;
    },
  });
  const [aviso, setAviso] = useState<string | null>(null);
  // Sala que se consulta en «Mi sala». Queda fuera de `Vista`: Grabar de la barra no la hereda.
  const [salaVista, setSalaVista] = useState(salaPropia);
  const deMiSala = ninos.filter((n) => n.sala === salaPropia);
  const confirmadas = useNotas(ninos, { mias: 'true', estado: 'confirmada' });

  const ahora = new Date();
  const nueva = (formato: Formato) => ir({ tipo: 'nueva', formato });
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
    // Vuelve a donde se abrió la nota (la ficha, Inicio o la pestaña de la barra).
    const salir = () => volver(ninoId ? { tipo: 'ficha', ninoId } : INICIO);
    contenido = (
      <NuevaNota
        formato={vista.formato}
        ninos={deMiSala}
        // Desde la ficha puede venir un niño o niña de otra sala.
        ninoFijo={ninos.find((n) => n.id === ninoId)}
        catalogo={catalogo}
        onCancelar={() => salida.pedir(salir)}
        onBorrada={salir}
        onEnCurso={salida.marcar}
        onGuardada={(nino) => {
          alGuardar(nino);
          salir();
        }}
      />
    );
  } else if (vista.tipo === 'revisar') {
    const salir = () => volver({ tipo: 'notas' });
    contenido = (
      <RevisarCaptura
        capturaId={vista.capturaId}
        ninos={ninos}
        catalogo={catalogo}
        onCancelar={() => salida.pedir(salir)}
        onBorrada={salir}
        onEnCurso={salida.marcar}
        onGuardada={(nino) => {
          alGuardar(nino);
          salir();
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
          onVolver={() => volver({ tipo: 'sala' })}
          onGrabar={() => ir({ tipo: 'nueva', formato: 'audio', ninoId: fichaDe.id })}
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
          onAbrir={(ninoId) => ir({ tipo: 'ficha', ninoId })}
        />
      );
    } else if (vista.tipo === 'notas') {
      pantalla = (
        <MisNotas
          ninos={ninos}
          ahora={ahora}
          onRevisar={(capturaId) => ir({ tipo: 'revisar', capturaId })}
        />
      );
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
          onInicio={() => ir(INICIO)}
          onSala={() => ir({ tipo: 'sala' })}
          onGrabar={() => nueva('audio')}
          onNotas={() => ir({ tipo: 'notas' })}
        />
      </>
    );
  }

  return (
    <>
      <Marco>{contenido}</Marco>
      {avisoGuardado}
      {salida.dialogo}
    </>
  );
}
