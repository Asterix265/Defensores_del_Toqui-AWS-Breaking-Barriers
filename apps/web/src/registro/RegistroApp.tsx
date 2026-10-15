import { useState, type ComponentProps, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { BarraInferior } from './BarraInferior';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useCatalogo, useNinos } from './api';
import type { Formato, Nino, Nota } from './datos';
import { FichaNino } from './FichaNino';
import { Ingreso } from './Ingreso';
import { Inicio } from './Inicio';
import { MiSala } from './MiSala';
import { MisNotas } from './MisNotas';
import { NuevaNota } from './NuevaNota';
import { PanelSalas } from './PanelSalas';
import { colores } from './tema';

const CLAVE_SESION = 'toqui.registro.correo';
/** Sala de la educadora: la API aún no la sabe (llegará con Cognito), así que se recuerda aquí. */
const CLAVE_SALA = 'toqui.registro.sala';

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

function leerSesion(): string | null {
  try {
    return localStorage.getItem(CLAVE_SESION);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento disponible el valor dura lo que dure la pestaña.
  }
}

function leerSala(): string | null {
  try {
    return localStorage.getItem(CLAVE_SALA);
  } catch {
    return null;
  }
}

/** «mercedes@integra.cl» → «Mercedes». */
function nombreDesdeCorreo(correo: string): string {
  const base = correo.split('@')[0]?.split(/[._-]/)[0] ?? '';
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'tía';
}

function esHoy(fecha: Date, ahora: Date): boolean {
  return fecha.toDateString() === ahora.toDateString();
}

/**
 * App «Registro Simple». En el celular, el flujo de la tía (diseño 1b + pantallas
 * comunes 1d); en pantallas anchas, el panel de notas de las salas (diseño 1e) con carga
 * de notas desde el PC.
 * Niños, niñas, catálogo, niveles y registros anteriores vienen de la API. El ingreso, el
 * procesamiento de la nota y la propuesta de la IA siguen simulados, y las notas nuevas viven
 * en memoria hasta que exista el guardado en la API.
 */
export function RegistroApp() {
  const [correo, setCorreo] = useState<string | null>(leerSesion);
  const ninos = useNinos();
  const catalogo = useCatalogo();
  const escritorio = useMediaQuery(useTheme().breakpoints.up('md'));

  const marco = (contenido: ReactNode) => (
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
        {contenido}
      </Box>
    </Box>
  );

  if (!correo) {
    return marco(
      <Ingreso
        onIngresar={(c) => {
          guardar(CLAVE_SESION, c);
          setCorreo(c);
        }}
      />,
    );
  }
  if (ninos.isError || catalogo.isError) {
    return marco(
      <Estado
        mensaje="No se pudo conectar con la API. Revisa que esté levantada (pnpm dev)."
        onReintentar={() => window.location.reload()}
      />,
    );
  }
  if (!ninos.data || !catalogo.niveles || !catalogo.manifestaciones) {
    return marco(<Estado mensaje="Cargando tu jardín…" cargando />);
  }
  return (
    <AppConDatos
      nombre={nombreDesdeCorreo(correo)}
      ninos={ninos.data}
      catalogo={{ niveles: catalogo.niveles, manifestaciones: catalogo.manifestaciones }}
      escritorio={escritorio}
      marco={marco}
    />
  );
}

function Estado({
  mensaje,
  cargando = false,
  onReintentar,
}: {
  mensaje: string;
  cargando?: boolean;
  onReintentar?: () => void;
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
    </Box>
  );
}

function AppConDatos({
  nombre,
  ninos,
  catalogo,
  escritorio,
  marco,
}: {
  nombre: string;
  ninos: Nino[];
  catalogo: ComponentProps<typeof NuevaNota>['catalogo'];
  escritorio: boolean;
  marco: (contenido: ReactNode) => ReactNode;
}) {
  const salas = [...new Set(ninos.map((n) => n.sala))].sort();
  const guardada = leerSala();
  const salaPropia = guardada && salas.includes(guardada) ? guardada : (salas[0] ?? '');
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });
  const [notas, setNotas] = useState<Nota[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  // Sala que se consulta en «Mi sala». Queda fuera de `Vista`: Grabar de la barra no la hereda.
  const [salaVista, setSalaVista] = useState(salaPropia);
  const deMiSala = ninos.filter((n) => n.sala === salaPropia);

  const ahora = new Date();
  const nueva = (formato: Formato) => setVista({ tipo: 'nueva', formato });
  const guardarNota = (nota: Nota) => {
    setNotas((previas) => [nota, ...previas]);
    setAviso(`Nota guardada para ${nota.nino.nombre}`);
  };

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
          catalogo={catalogo}
          notas={notas}
          ahora={ahora}
          nombre={nombre}
          onGuardar={guardarNota}
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
        semilla={notas.length}
        educadora={nombre}
        onCancelar={volver}
        onGuardar={(nota) => {
          guardarNota(nota);
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
          notas={notas}
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
          notas={notas}
          ahora={ahora}
          sala={salaVista}
          onCambiarSala={setSalaVista}
          onAbrir={(ninoId) => setVista({ tipo: 'ficha', ninoId })}
        />
      );
    } else if (vista.tipo === 'notas') {
      pantalla = <MisNotas notas={notas} ahora={ahora} />;
    } else {
      pantalla = (
        <Inicio
          nombre={nombre}
          notasHoy={notas.filter((n) => esHoy(n.creada, ahora)).length}
          onElegir={nueva}
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
