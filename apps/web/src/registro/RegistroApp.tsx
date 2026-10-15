import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { BarraInferior } from './BarraInferior';
import { NINOS, NINOS_DE_MI_SALA, notasDeEjemplo, type Formato, type Nota } from './datos';
import { Ingreso } from './Ingreso';
import { Inicio } from './Inicio';
import { MisNotas } from './MisNotas';
import { NuevaNota } from './NuevaNota';
import { PanelSalas } from './PanelSalas';
import { colores } from './tema';

const CLAVE_SESION = 'toqui.registro.correo';

type Vista = { tipo: 'inicio' } | { tipo: 'notas' } | { tipo: 'nueva'; formato: Formato };

function leerSesion(): string | null {
  try {
    return localStorage.getItem(CLAVE_SESION);
  } catch {
    return null;
  }
}

function guardarSesion(correo: string) {
  try {
    localStorage.setItem(CLAVE_SESION, correo);
  } catch {
    // Sin almacenamiento disponible la sesión dura lo que dure la pestaña.
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
 * App «Registro Simple» (mock). En el celular, el flujo de la tía (diseño 1b + pantallas
 * comunes 1d); en pantallas anchas, el panel de notas de las salas (diseño 1e) con carga
 * de notas desde el PC.
 * Las notas viven en memoria y se pierden al recargar: aún no hay API de capturas.
 */
export function RegistroApp() {
  const [correo, setCorreo] = useState<string | null>(leerSesion);
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });
  const [notas, setNotas] = useState<Nota[]>(() => notasDeEjemplo(new Date()));
  const [aviso, setAviso] = useState<string | null>(null);
  const escritorio = useMediaQuery(useTheme().breakpoints.up('md'));

  const ahora = new Date();
  const nueva = (formato: Formato) => setVista({ tipo: 'nueva', formato });
  const guardar = (nota: Nota) => {
    setNotas((previas) => [nota, ...previas]);
    const nombre = NINOS.find((n) => n.id === nota.ninoId)?.nombre ?? '';
    setAviso(`Nota guardada para ${nombre}`);
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

  if (correo && escritorio) {
    return (
      <>
        <PanelSalas
          notas={notas}
          ahora={ahora}
          nombre={nombreDesdeCorreo(correo)}
          onGuardar={guardar}
        />
        {avisoGuardado}
      </>
    );
  }

  let contenido;
  if (!correo) {
    contenido = (
      <Ingreso
        onIngresar={(c) => {
          guardarSesion(c);
          setCorreo(c);
        }}
      />
    );
  } else if (vista.tipo === 'nueva') {
    contenido = (
      <NuevaNota
        formato={vista.formato}
        semilla={notas.length}
        educadora={nombreDesdeCorreo(correo)}
        onCancelar={() => setVista({ tipo: 'inicio' })}
        onGuardar={(nota) => {
          guardar(nota);
          setVista({ tipo: 'inicio' });
        }}
      />
    );
  } else {
    contenido = (
      <>
        {vista.tipo === 'inicio' ? (
          <Inicio
            nombre={nombreDesdeCorreo(correo)}
            notasHoy={
              notas.filter(
                (n) =>
                  esHoy(n.creada, ahora) && NINOS_DE_MI_SALA.some((nino) => nino.id === n.ninoId),
              ).length
            }
            onElegir={nueva}
          />
        ) : (
          <MisNotas notas={notas} ahora={ahora} />
        )}
        <BarraInferior
          activa={vista.tipo}
          onInicio={() => setVista({ tipo: 'inicio' })}
          onGrabar={() => nueva('audio')}
          onNotas={() => setVista({ tipo: 'notas' })}
        />
      </>
    );
  }

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
        {contenido}
      </Box>
      {avisoGuardado}
    </Box>
  );
}
