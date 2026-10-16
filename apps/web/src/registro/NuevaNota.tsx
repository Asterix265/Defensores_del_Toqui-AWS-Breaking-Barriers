import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { keyframes } from '@emotion/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import {
  getObtenerArchivoCapturaQueryKey,
  getObtenerCapturaQueryKey,
  obtenerArchivoCaptura,
  obtenerCaptura,
} from '../api/generated/capturas/capturas';
import { etiquetaSala, ordenarSalas, type Manifestacion, type NivelRuta } from './api';
import {
  formatoBytes,
  iniciarGrabacion,
  motivoMicrofono,
  prepararFoto,
  type Grabacion,
} from './captura';
import {
  AvisoVerde,
  CabeceraConCerrar,
  ChipArea,
  Encabezado,
  NinoAvatar,
  Pantalla,
  PieAcciones,
} from './componentes';
import { formatoDuracion, textoLegible } from './formato';
import { NUCLEOS, type Formato, type ManifestacionCitada, type Nino } from './datos';
import {
  nivelInicial,
  registrarCaptura,
  useConfirmar,
  useDescartar,
  type CapturaDetalle,
  type Entrada,
  type EtapaRegistro,
  type Procesamiento,
} from './registrar';
import type { EnCurso } from './salida';
import { SubirArchivo } from './SubirArchivo';
import { colores } from './tema';

type Etapa = 'grabando' | 'camara' | 'subir' | 'escribiendo' | 'nino' | 'procesando' | 'revision';

const ETAPA_INICIAL: Record<Formato, Etapa> = {
  audio: 'grabando',
  foto: 'camara',
  texto: 'escribiendo',
};

const CAPTURA_LISTA: Record<Formato, string> = {
  audio: 'Audio listo',
  foto: 'Foto lista',
  texto: 'Nota lista',
};

const SUBTITULO_REVISION: Record<Formato, string> = {
  audio: 'Esto entendimos de tu audio',
  foto: 'Esto leímos en tu post-it',
  texto: 'Revisa tu nota',
};

/** Máximo de manifestaciones por nota (el mismo límite que la confirmación de la API). */
const MAXIMO_MANIFESTACIONES = 5;

/**
 * Flujo «acción primero» (diseño 1b): capturar, elegir al niño o niña, procesar y confirmar.
 * El audio se graba con el micrófono y la foto se toma con la cámara (o se elige); al elegir al
 * niño o niña se crea la captura en la API, el archivo se sube a S3 y la revisión muestra el
 * borrador que devuelve la API, con el aviso de lo que aún está simulado.
 * En PC (`escritorio`) la foto y el audio también se pueden subir como archivo.
 * Con `ninoFijo` (desde la ficha del niño o niña) la nota ya tiene dueño y se salta la elección.
 */
export function NuevaNota({
  formato,
  escritorio = false,
  ninos,
  ninoFijo,
  salaPrimero,
  catalogo,
  onGuardada,
  onCancelar,
  onBorrada = onCancelar,
  onEnCurso,
}: {
  formato: Formato;
  escritorio?: boolean;
  /** Niños y niñas que se ofrecen en «¿De quién es?». */
  ninos: Nino[];
  /** Niño o niña ya elegido: la nota se le asocia sin pasar por «¿De quién es?». */
  ninoFijo?: Nino;
  /** Sala que va primero en «¿De quién es?» (en el celular, la que se está viendo en «Mi sala»). */
  salaPrimero?: string;
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  /** La nota quedó confirmada en la API. */
  onGuardada: (nino: Nino) => void;
  /** La educadora pidió salir (Cancelar o la ×); quien llama decide si confirmar. */
  onCancelar: () => void;
  /** La educadora borró la nota desde la revisión. */
  onBorrada?: () => void;
  /** Qué se perdería al salir ahora; vuelve a `no` al cerrar la nota. */
  onEnCurso?: (enCurso: EnCurso) => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(
    escritorio && formato !== 'texto' ? 'subir' : ETAPA_INICIAL[formato],
  );
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [duracion, setDuracion] = useState<number>();
  const [nombreArchivo, setNombreArchivo] = useState<string>();
  const [ninoId, setNinoId] = useState<string | null>(ninoFijo?.id ?? null);
  const [captura, setCaptura] = useState<CapturaDetalle | null>(null);
  const [grabando, setGrabando] = useState(false);
  const [hayTexto, setHayTexto] = useState(false);
  const vistaPrevia = useVistaPrevia(entrada);
  const cliente = useQueryClient();

  const nino = ninoFijo ?? ninos.find((n) => n.id === ninoId);

  // Desde que se crea la captura en la API, salir no la borra: queda «Sin revisar».
  let enCurso: EnCurso = 'no';
  if (etapa === 'procesando' || etapa === 'revision') enCurso = 'revision';
  else if (
    etapa === 'nino' ||
    (etapa === 'grabando' && grabando) ||
    (etapa === 'escribiendo' && hayTexto)
  ) {
    enCurso = 'captura';
  }
  useEffect(() => onEnCurso?.(enCurso), [enCurso, onEnCurso]);
  useEffect(() => () => onEnCurso?.('no'), [onEnCurso]);

  const capturar = (nueva: Entrada) => {
    setEntrada(nueva);
    setEtapa(ninoFijo ? 'procesando' : 'nino');
  };

  switch (etapa) {
    case 'grabando':
      return (
        <Grabando
          onCancelar={onCancelar}
          onGrabando={setGrabando}
          onTerminar={(audio, segundos) => {
            setDuracion(segundos);
            capturar({ formato: 'audio', archivo: audio });
          }}
        />
      );
    case 'camara':
      return (
        <Camara
          onCancelar={onCancelar}
          onTomar={(foto) => {
            setNombreArchivo(foto.name);
            capturar({ formato: 'foto', archivo: foto });
          }}
        />
      );
    case 'subir':
      if (formato === 'texto') return null;
      return (
        <SubirArchivo
          tipo={formato}
          onCancelar={onCancelar}
          onGrabar={formato === 'audio' ? () => setEtapa('grabando') : undefined}
          onListo={(archivo) => {
            setNombreArchivo(archivo.name);
            capturar({ formato, archivo });
          }}
        />
      );
    case 'escribiendo':
      return (
        <Escribiendo
          onCancelar={onCancelar}
          onHayTexto={setHayTexto}
          onListo={(texto) => capturar({ formato: 'texto', texto })}
        />
      );
    case 'nino':
      return (
        <ElegirNino
          aviso={CAPTURA_LISTA[formato]}
          ninos={ninos}
          // Con niños y niñas de varias salas (PC, o el celular, que ofrece todo el jardín).
          agrupar={escritorio || new Set(ninos.map((n) => n.sala)).size > 1}
          salaPrimero={salaPrimero}
          seleccionado={ninoId}
          onSeleccionar={setNinoId}
          onSeguir={() => setEtapa('procesando')}
          onCancelar={onCancelar}
        />
      );
    case 'procesando':
      if (!nino || !entrada) return null;
      return (
        <Procesando
          nino={nino}
          entrada={entrada}
          onListo={(detalle) => {
            setCaptura(detalle);
            setEtapa('revision');
            // La nota ya existe en la API: si se cierra sin decidir, aparece «Sin revisar».
            void cliente.invalidateQueries({ queryKey: ['/api/capturas'] });
          }}
          onCancelar={onCancelar}
        />
      );
    case 'revision':
      if (!nino || !captura) return null;
      return (
        <Revision
          formato={formato}
          nino={nino}
          captura={captura}
          duracion={duracion}
          nombreArchivo={nombreArchivo}
          vistaPrevia={vistaPrevia}
          catalogo={catalogo}
          onGuardada={() => onGuardada(nino)}
          onBorrada={onBorrada}
          onCancelar={onCancelar}
        />
      );
  }
}

/** URL local del audio o la foto para mostrarlo sin volver a pedirlo a S3. */
function useVistaPrevia(entrada: Entrada | null): string | undefined {
  const url = useMemo(
    () =>
      entrada && entrada.formato !== 'texto' ? URL.createObjectURL(entrada.archivo) : undefined,
    [entrada],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/**
 * Revisión de una nota que ya está en la API (diseño D4): la abre «Mis notas» o «Por revisar».
 * Usa la misma `Revision`; el audio o la foto se piden con la URL temporal de la API.
 */
export function RevisarCaptura({
  capturaId,
  ninos,
  catalogo,
  onGuardada,
  onCancelar,
  onBorrada = onCancelar,
  onEnCurso,
}: {
  capturaId: string;
  /** Niños y niñas del jardín, para mostrar al dueño de la nota. */
  ninos: Nino[];
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  onGuardada: (nino: Nino) => void;
  onCancelar: () => void;
  onBorrada?: () => void;
  onEnCurso?: (enCurso: EnCurso) => void;
}) {
  const consulta = useQuery({
    queryKey: getObtenerCapturaQueryKey(capturaId),
    queryFn: async ({ signal }) => {
      const res = await obtenerCaptura(capturaId, { signal });
      if (res.status !== 200) throw new Error(`La API respondió ${res.status}`);
      return res.data;
    },
  });
  const captura = consulta.data;
  const archivo = useQuery({
    queryKey: getObtenerArchivoCapturaQueryKey(capturaId),
    queryFn: async ({ signal }) => {
      const res = await obtenerArchivoCaptura(capturaId, { signal });
      if (res.status !== 200) throw new Error(`La API respondió ${res.status}`);
      return res.data;
    },
    enabled: captura?.tieneArchivo === true,
    // La URL es temporal: no se reutiliza entre aperturas.
    gcTime: 0,
  });
  const nino = captura && ninos.find((n) => n.id === captura.nino.id);
  const pendiente = captura?.estado === 'borrador_listo' || captura?.estado === 'error';

  useEffect(() => onEnCurso?.(pendiente ? 'revision' : 'no'), [pendiente, onEnCurso]);
  useEffect(() => () => onEnCurso?.('no'), [onEnCurso]);

  if (captura && nino && pendiente) {
    return (
      <Revision
        formato={captura.formato}
        nino={nino}
        captura={captura}
        vistaPrevia={archivo.data?.url}
        catalogo={catalogo}
        onGuardada={() => onGuardada(nino)}
        onBorrada={onBorrada}
        onCancelar={onCancelar}
      />
    );
  }

  let mensaje = 'Cargando la nota…';
  if (consulta.isError || (captura && !nino)) mensaje = 'No se pudo abrir la nota.';
  else if (captura?.estado === 'procesando') {
    mensaje = 'La nota sigue procesándose. Vuelve a abrirla en un momento.';
  } else if (captura) mensaje = 'Esta nota ya no está pendiente de revisión.';
  return (
    <Pantalla>
      <CabeceraConCerrar titulo="Revisar nota" etiquetaCerrar="Cerrar" onCancelar={onCancelar} />
      <Stack sx={{ flex: 1, px: 2.5, pt: 4, gap: 2.5, alignItems: 'center' }}>
        {consulta.isPending && <CircularProgress aria-hidden />}
        <Typography
          role={consulta.isPending ? 'status' : 'alert'}
          sx={{ fontSize: 17, fontWeight: 700 }}
        >
          {mensaje}
        </Typography>
      </Stack>
      <PieAcciones>
        <Button variant="text" onClick={onCancelar} sx={{ color: 'text.secondary' }}>
          Volver
        </Button>
      </PieAcciones>
    </Pantalla>
  );
}

const onda = keyframes`
  0%, 100% { transform: scaleY(.45); }
  50% { transform: scaleY(1); }
`;

const BARRAS = [20, 38, 56, 30, 48, 24, 42, 18];

/** Graba con el micrófono del dispositivo. Si no hay permiso, lo explica y permite volver. */
function Grabando({
  onTerminar,
  onGrabando,
  onCancelar,
}: {
  onTerminar: (audio: Blob, segundos: number) => void;
  /** Hay audio grabándose (no mientras se pide el micrófono ni si no hay permiso). */
  onGrabando: (grabando: boolean) => void;
  onCancelar: () => void;
}) {
  const [segundos, setSegundos] = useState(0);
  const [estado, setEstado] = useState<'pidiendo' | 'grabando' | 'terminando'>('pidiendo');
  const [error, setError] = useState<string | null>(null);
  const grabacion = useRef<Grabacion | null>(null);

  useEffect(() => {
    let vigente = true;
    iniciarGrabacion()
      .then((g) => {
        if (!vigente) return g.cancelar();
        grabacion.current = g;
        setEstado('grabando');
      })
      .catch((e: unknown) => vigente && setError(motivoMicrofono(e)));
    return () => {
      vigente = false;
      grabacion.current?.cancelar();
    };
  }, []);

  useEffect(() => onGrabando(estado === 'grabando' && !error), [estado, error, onGrabando]);

  useEffect(() => {
    if (estado !== 'grabando') return;
    const intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(intervalo);
  }, [estado]);

  const terminar = async () => {
    const g = grabacion.current;
    if (!g) return;
    setEstado('terminando');
    grabacion.current = null;
    onTerminar(await g.detener(), Math.max(segundos, 1));
  };

  return (
    <Pantalla>
      <Encabezado titulo="Nota de audio" />
      {error ? (
        <Stack sx={{ flex: 1, px: 2.5, pt: 3, gap: 2 }}>
          <Alert severity="error" sx={{ borderRadius: '14px', fontSize: 16 }}>
            <AlertTitle>No se puede grabar</AlertTitle>
            {error} Puedes escribir la nota o tomar una foto.
          </Alert>
        </Stack>
      ) : (
        <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2.75 }}>
          <Box
            role="status"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontWeight: 800,
              color: 'primary.dark',
            }}
          >
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
            {estado === 'pidiendo' ? 'Pidiendo el micrófono…' : 'Grabando'}
          </Box>
          <Box
            role="timer"
            aria-label="Tiempo grabado"
            sx={{ fontSize: 56, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatoDuracion(segundos)}
          </Box>
          <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: 60 }}>
            {BARRAS.map((alto, i) => (
              <Box
                key={i}
                sx={{
                  width: 7,
                  height: alto,
                  borderRadius: '9px',
                  bgcolor: i % 3 === 0 ? '#e4a0a6' : 'primary.main',
                  animation:
                    estado === 'grabando'
                      ? `${onda} ${0.8 + (i % 4) * 0.15}s ease-in-out infinite`
                      : 'none',
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              />
            ))}
          </Box>
          <ButtonBase
            aria-label="Terminar grabación"
            disabled={estado !== 'grabando'}
            onClick={() => void terminar()}
            sx={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              opacity: estado === 'grabando' ? 1 : 0.5,
              boxShadow: `0 0 0 14px ${colores.rojoSuave}, 0 10px 30px -4px rgba(214,40,57,.4)`,
            }}
          >
            <Box sx={{ width: 38, height: 38, borderRadius: '8px', bgcolor: '#fff' }} />
          </ButtonBase>
          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Presiona para terminar</Typography>
        </Stack>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'center', px: 2.5, pb: 4 }}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<CloseRounded />}
          onClick={onCancelar}
          sx={{
            minHeight: 52,
            px: 3,
            fontSize: 16,
            fontWeight: 700,
            bgcolor: '#fff',
            color: 'text.secondary',
            borderColor: 'divider',
          }}
        >
          Cancelar
        </Button>
      </Box>
    </Pantalla>
  );
}

/**
 * Foto del post-it: abre la cámara del celular (o el selector de archivos en un PC) y prepara la
 * imagen como JPEG o PNG de hasta 10 MB.
 */
function Camara({
  onTomar,
  onCancelar,
}: {
  onTomar: (foto: File) => void;
  onCancelar: () => void;
}) {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setPreparando(true);
    try {
      onTomar(await prepararFoto(archivo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo usar esa foto.');
      setPreparando(false);
    }
  };

  return (
    <Pantalla>
      <CabeceraConCerrar titulo="Foto del post-it" onCancelar={onCancelar} />
      <Stack sx={{ flex: 1, px: 2.5, pt: 3, gap: 2, alignItems: 'center' }}>
        <Typography sx={{ fontSize: 17, fontWeight: 600, textAlign: 'center' }}>
          Toma una foto del post-it o de tu nota en papel, con buena luz.
        </Typography>
        <ButtonBase
          aria-label="Tomar foto"
          disabled={preparando}
          onClick={() => camara.current?.click()}
          sx={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: '#fff',
            boxShadow: `0 0 0 14px ${colores.rojoSuave}`,
          }}
        >
          {preparando ? (
            <CircularProgress aria-hidden sx={{ color: '#fff' }} />
          ) : (
            <PhotoCameraRounded sx={{ fontSize: 56 }} />
          )}
        </ButtonBase>
        <Button
          variant="text"
          startIcon={<PhotoLibraryRounded />}
          disabled={preparando}
          onClick={() => galeria.current?.click()}
          sx={{ color: 'primary.dark' }}
        >
          Elegir una foto guardada
        </Button>
        {error && (
          <Alert severity="error" sx={{ borderRadius: '14px', alignSelf: 'stretch' }}>
            {error}
          </Alert>
        )}
        <input
          ref={camara}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Cámara"
          hidden
          onChange={(e) => void elegir(e.target.files?.[0])}
        />
        <input
          ref={galeria}
          type="file"
          accept="image/*"
          aria-label="Foto guardada"
          hidden
          onChange={(e) => void elegir(e.target.files?.[0])}
        />
      </Stack>
    </Pantalla>
  );
}

function Escribiendo({
  onListo,
  onHayTexto,
  onCancelar,
}: {
  onListo: (texto: string) => void;
  onHayTexto: (hay: boolean) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const hay = texto.trim() !== '';
  useEffect(() => onHayTexto(hay), [hay, onHayTexto]);
  return (
    <Pantalla>
      <CabeceraConCerrar titulo="Escribe tu nota" onCancelar={onCancelar} />
      <Box sx={{ px: 2, pt: 2 }}>
        <CajaTexto valor={texto} onCambio={setTexto} autoFocus etiqueta="Texto de la nota" />
      </Box>
      <PieAcciones>
        <Button
          variant="contained"
          fullWidth
          disabled={!hay}
          endIcon={<ArrowForwardRounded />}
          onClick={() => onListo(texto.trim())}
        >
          Listo
        </Button>
      </PieAcciones>
    </Pantalla>
  );
}

function ElegirNino({
  aviso,
  ninos,
  agrupar,
  salaPrimero,
  seleccionado,
  onSeleccionar,
  onSeguir,
  onCancelar,
}: {
  aviso: string;
  ninos: Nino[];
  /** Con varias salas, cada una se muestra con su título. */
  agrupar: boolean;
  salaPrimero?: string;
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  onSeguir: () => void;
  onCancelar: () => void;
}) {
  const elegido = ninos.find((n) => n.id === seleccionado);
  const grupos = agrupar
    ? ordenarSalas([...new Set(ninos.map((n) => n.sala))])
        // La sala que se está viendo, primero; el resto en el orden habitual.
        .sort((a, b) => Number(b === salaPrimero) - Number(a === salaPrimero))
        .map((sala) => ({
          sala,
          ninos: ninos.filter((n) => n.sala === sala),
        }))
    : [{ sala: null, ninos }];
  return (
    <Pantalla>
      <CabeceraConCerrar
        titulo="¿De quién es?"
        subtitulo="Elige a un niño o niña"
        onCancelar={onCancelar}
      />
      <Box sx={{ px: 2, pt: 1.75 }}>
        <AvisoVerde icono={<CheckCircleRounded />}>{aviso}</AvisoVerde>
      </Box>
      <Box>
        {grupos.map((grupo) => (
          <Box
            key={grupo.sala ?? 'sala'}
            component="section"
            aria-label={grupo.sala ? etiquetaSala(grupo.sala) : undefined}
          >
            {grupo.sala && (
              <Typography
                variant="h2"
                color="text.secondary"
                sx={{ px: 2.5, pt: 2, textTransform: 'uppercase' }}
              >
                {etiquetaSala(grupo.sala)}
              </Typography>
            )}
            <GrillaNinos
              ninos={grupo.ninos}
              seleccionado={seleccionado}
              onSeleccionar={onSeleccionar}
            />
          </Box>
        ))}
      </Box>
      <PieAcciones>
        <Button
          variant="contained"
          fullWidth
          disabled={!elegido}
          endIcon={elegido ? <ArrowForwardRounded /> : undefined}
          onClick={onSeguir}
          sx={{ boxShadow: elegido ? '0 8px 24px -4px rgba(214,40,57,.3)' : 'none' }}
        >
          {elegido ? `Seguir con ${elegido.nombre}` : 'Elige un niño o niña'}
        </Button>
      </PieAcciones>
    </Pantalla>
  );
}

function GrillaNinos({
  ninos,
  seleccionado,
  onSeleccionar,
}: {
  ninos: Nino[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        p: 2,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        rowGap: 1.75,
        columnGap: 1,
      }}
    >
      {ninos.map((nino) => {
        const activo = nino.id === seleccionado;
        return (
          <ButtonBase
            key={nino.id}
            aria-label={nino.nombre}
            aria-pressed={activo}
            onClick={() => onSeleccionar(nino.id)}
            sx={{ flexDirection: 'column', gap: 0.75, py: 0.5, borderRadius: '12px' }}
          >
            <Box
              sx={{
                borderRadius: '50%',
                boxShadow: activo
                  ? `0 0 0 4px ${colores.crema}, 0 0 0 7px ${colores.rojo}`
                  : 'none',
              }}
            >
              <NinoAvatar nino={nino} tamano={76} />
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: 15,
                fontWeight: activo ? 800 : 600,
                color: activo ? 'primary.dark' : 'text.primary',
              }}
            >
              {nino.nombre}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

const TEXTO_ETAPA: Record<EtapaRegistro, string> = {
  creando: 'Creando la nota…',
  subiendo: 'Subiendo el archivo a S3…',
  procesando: 'Procesando la nota…',
};

/** Crea la captura en la API, sube el archivo y espera el borrador. */
function Procesando({
  nino,
  entrada,
  onListo,
  onCancelar,
}: {
  nino: Nino;
  entrada: Entrada;
  onListo: (captura: CapturaDetalle) => void;
  onCancelar: () => void;
}) {
  const [etapa, setEtapa] = useState<EtapaRegistro>('creando');
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const alListo = useEffectEvent(onListo);
  // Una sola captura por intento: en desarrollo, StrictMode ejecuta dos veces el efecto y sin
  // esto la API recibiría dos POST /capturas (dos notas gemelas).
  const registro = useRef<{ intento: number; promesa: Promise<CapturaDetalle> } | null>(null);

  useEffect(() => {
    let vigente = true;
    if (registro.current?.intento !== intento) {
      registro.current = { intento, promesa: registrarCaptura(nino, entrada, setEtapa) };
    }
    registro.current.promesa
      .then((captura) => vigente && alListo(captura))
      .catch(
        (e: unknown) =>
          vigente && setError(e instanceof Error ? e.message : 'No se pudo guardar la nota.'),
      );
    return () => {
      vigente = false;
    };
  }, [nino, entrada, intento]);

  return (
    <Pantalla>
      <Encabezado titulo={`Nota de ${nino.nombre}`} />
      <Stack sx={{ flex: 1, px: 2.5, pt: 4, gap: 2.5, alignItems: 'center' }}>
        {error ? (
          <Alert severity="error" sx={{ borderRadius: '14px', alignSelf: 'stretch', fontSize: 16 }}>
            <AlertTitle>No se pudo guardar la nota</AlertTitle>
            {error}
          </Alert>
        ) : (
          <>
            <CircularProgress aria-hidden />
            <Typography role="status" sx={{ fontSize: 18, fontWeight: 700 }}>
              {TEXTO_ETAPA[etapa]}
            </Typography>
          </>
        )}
      </Stack>
      <PieAcciones>
        {error && (
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              setError(null);
              setIntento((i) => i + 1);
            }}
          >
            Reintentar
          </Button>
        )}
        <Button variant="text" onClick={onCancelar} sx={{ color: 'text.secondary' }}>
          Cancelar
        </Button>
      </PieAcciones>
    </Pantalla>
  );
}

const NOMBRE_PASO: Record<Procesamiento['pasos'][number]['paso'], string> = {
  transcripcion: 'Transcripción del audio',
  lectura_imagen: 'Lectura de la foto',
  extraccion: 'Nivel y manifestaciones',
};

const ESTADO_PASO: Record<Procesamiento['pasos'][number]['estado'], string> = {
  no_implementado: 'no implementado',
  simulado: 'simulado',
  completado: 'listo',
};

const NOMBRE_FORMATO: Record<Formato, string> = { audio: 'Audio', foto: 'Foto', texto: 'Texto' };

/** Rótulo del texto de la revisión cuando es real. */
const TITULO_TEXTO: Record<Formato, string> = {
  audio: 'Lo que entendimos de tu audio',
  foto: 'Lo que leímos en tu foto',
  texto: 'Tu nota',
};

const LISTO_FORMATO: Record<Formato, string> = {
  audio: 'Listo: revisamos tu audio',
  foto: 'Listo: revisamos tu foto',
  texto: 'Listo: revisamos tu nota',
};

/**
 * Aviso de lo que se procesó: un título breve y, plegados, los detalles técnicos (archivo, S3 y
 * cada paso del pipeline). Si algún paso no es real, el título lo dice.
 */
function AvisoProcesamiento({ procesamiento }: { procesamiento: Procesamiento }) {
  const { entrada } = procesamiento;
  return (
    <Alert
      severity={procesamiento.simulado ? 'warning' : 'success'}
      sx={{ mx: 2, mt: 2, borderRadius: '14px', '& .MuiAlert-message': { minWidth: 0 } }}
    >
      <AlertTitle sx={{ fontWeight: 800, mb: 0 }}>
        {procesamiento.simulado
          ? 'Procesamiento simulado: aún no implementado'
          : LISTO_FORMATO[entrada.formato]}
      </AlertTitle>
      <Box
        component="details"
        sx={{ mt: 0.5, '& summary': { cursor: 'pointer', fontWeight: 700, fontSize: 14 } }}
      >
        <summary>Detalles técnicos</summary>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.75, overflowWrap: 'anywhere' }}>
          Se recibió: {NOMBRE_FORMATO[entrada.formato]}
          {entrada.tipoArchivo ? ` (${entrada.tipoArchivo}, ${formatoBytes(entrada.bytes)})` : ''}
          {entrada.claveS3 ? `, guardado en S3 (${entrada.claveS3}).` : '.'}
        </Typography>
        <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5 }}>
          {procesamiento.pasos.map((p) => (
            <Typography
              component="li"
              variant="body2"
              key={p.paso}
              sx={{ overflowWrap: 'anywhere' }}
            >
              <b>
                {NOMBRE_PASO[p.paso]}: {ESTADO_PASO[p.estado]}.
              </b>{' '}
              {p.detalle}
            </Typography>
          ))}
        </Box>
      </Box>
    </Alert>
  );
}

/**
 * Revisión del borrador de la API: la educadora confirma o corrige el nivel y las
 * manifestaciones, o descarta la nota. La decisión se guarda en la API.
 */
function Revision({
  formato,
  nino,
  captura,
  duracion,
  nombreArchivo,
  vistaPrevia,
  catalogo,
  onGuardada,
  onBorrada,
  onCancelar,
}: {
  formato: Formato;
  nino: Nino;
  captura: CapturaDetalle;
  duracion?: number;
  nombreArchivo?: string;
  vistaPrevia?: string;
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  onGuardada: () => void;
  onBorrada: () => void;
  /** Cerrar sin decidir: la nota queda «Sin revisar». */
  onCancelar: () => void;
}) {
  const { borrador } = captura;
  const sinPropuesta = !borrador || borrador.evidenciaInsuficiente;
  const [nivel, setNivel] = useState(borrador?.nivelSugerido ?? nivelInicial(catalogo.niveles));
  const [manifestaciones, setManifestaciones] = useState<ManifestacionCitada[]>(
    () => (borrador?.manifestaciones ?? []) as ManifestacionCitada[],
  );
  const [agregando, setAgregando] = useState(sinPropuesta);
  // Borrar no se puede deshacer: se pregunta antes.
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const confirmar = useConfirmar();
  const descartar = useDescartar();
  const ocupado = confirmar.isPending || descartar.isPending;
  const listo = manifestaciones.length > 0 && !ocupado;
  const error = confirmar.error ?? descartar.error;
  // El texto es de ejemplo solo si la transcripción o la lectura fueron simuladas (o la API
  // no lo informa, como en los borradores antiguos).
  const deEjemplo = formato !== 'texto' && (borrador?.procesamiento?.simulado ?? true);

  const cambiarNivel = (n: number) => {
    setNivel(n);
    // La API exige que todas las manifestaciones sean del nivel confirmado.
    setManifestaciones((previas) => previas.filter((m) => m.manifestacion.nivel === n));
  };

  return (
    <Pantalla>
      <CabeceraConCerrar
        titulo="¿Está bien?"
        subtitulo={SUBTITULO_REVISION[formato]}
        etiquetaCerrar="Cerrar revisión"
        onCancelar={onCancelar}
      />
      {borrador?.procesamiento && <AvisoProcesamiento procesamiento={borrador.procesamiento} />}
      {captura.estado === 'error' && (
        <Alert severity="error" sx={{ mx: 2, mt: 2, borderRadius: '14px' }}>
          No se pudo procesar la nota{captura.errorDetalle ? `: ${captura.errorDetalle}` : ''}.
          Elige tú lo que observaste.
        </Alert>
      )}
      <Stack
        sx={{
          mx: 2,
          mt: 2.25,
          p: 2,
          gap: 1.75,
          bgcolor: '#fff',
          border: 1,
          borderColor: 'divider',
          borderRadius: '16px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
            <NinoAvatar nino={nino} tamano={40} />
            <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{nino.nombre}</Typography>
          </Box>
          {formato === 'audio' && duracion !== undefined && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'text.secondary',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <MicRounded sx={{ fontSize: 20 }} />
              {formatoDuracion(duracion)}
            </Box>
          )}
        </Box>

        {vistaPrevia && formato === 'audio' && (
          <Box
            component="audio"
            controls
            src={vistaPrevia}
            aria-label="Audio grabado"
            sx={{ width: '100%' }}
          />
        )}
        {vistaPrevia && formato === 'foto' && (
          <Box
            component="img"
            src={vistaPrevia}
            alt={nombreArchivo ? `Foto ${nombreArchivo}` : 'Foto tomada'}
            sx={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: '12px' }}
          />
        )}

        {borrador && (
          <Stack sx={{ gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              {deEjemplo
                ? `Texto de ejemplo (no es ${formato === 'audio' ? 'tu audio' : 'tu foto'})`
                : TITULO_TEXTO[formato]}
            </Typography>
            <Box
              sx={{
                p: 1.75,
                bgcolor: colores.amarilloSuave,
                borderRadius: '12px',
                fontSize: 17,
                lineHeight: '26px',
                ...(deEjemplo && { border: `2px dashed ${colores.amarillo}` }),
              }}
            >
              {/* El original (con nombres); el anonimizado solo en notas anteriores a corregir-hallazgos-demo. */}
              {captura.texto ?? textoLegible(borrador.textoFuente)}
            </Box>
          </Stack>
        )}

        <Box sx={{ height: '1px', bgcolor: 'divider' }} />

        <ElegirNivel nivel={nivel} niveles={catalogo.niveles} onNivel={cambiarNivel} />

        <Stack sx={{ gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {sinPropuesta ? 'Elige lo que observaste' : 'Lo que observaste'}
          </Typography>
          {sinPropuesta && manifestaciones.length === 0 && (
            <Typography sx={{ fontSize: 15, color: colores.amarilloTinta, fontWeight: 600 }}>
              No encontramos evidencia suficiente en la nota. Agrega al menos una manifestación.
            </Typography>
          )}
          {manifestaciones.map(({ manifestacion, cita }) => (
            <Box
              key={manifestacion.id}
              component="section"
              aria-label={manifestacion.textoObservable}
              sx={{
                p: 1.5,
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
                border: 1,
                borderColor: 'divider',
                borderRadius: '12px',
              }}
            >
              <Stack sx={{ flex: 1, gap: 0.75, minWidth: 0 }}>
                <Box>
                  <ChipArea area={manifestacion.nucleo} compacto />
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: '22px' }}>
                  {manifestacion.textoObservable}
                </Typography>
                {cita && (
                  <Typography variant="body2" color="text.secondary">
                    «{textoLegible(cita)}»
                  </Typography>
                )}
              </Stack>
              <IconButton
                aria-label={`Quitar «${manifestacion.textoObservable}»`}
                onClick={() =>
                  setManifestaciones(
                    manifestaciones.filter((m) => m.manifestacion.id !== manifestacion.id),
                  )
                }
              >
                <CloseRounded />
              </IconButton>
            </Box>
          ))}
          {agregando ? (
            <AgregarManifestacion
              opciones={catalogo.manifestaciones.filter(
                (m) =>
                  m.nivel === nivel &&
                  m.nivelEducativo === nino.nivelEducativo &&
                  !manifestaciones.some((elegida) => elegida.manifestacion.id === m.id),
              )}
              lleno={manifestaciones.length >= MAXIMO_MANIFESTACIONES}
              onAgregar={(m) =>
                setManifestaciones([...manifestaciones, { manifestacion: m, cita: null }])
              }
              onCerrar={() => setAgregando(false)}
            />
          ) : (
            <Box>
              <Button
                variant="text"
                startIcon={<AddRounded />}
                disabled={manifestaciones.length >= MAXIMO_MANIFESTACIONES}
                onClick={() => setAgregando(true)}
                sx={{ color: 'primary.dark', fontSize: 15, minHeight: 40, px: 1, ml: -1 }}
              >
                Agregar manifestación
              </Button>
            </Box>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 2, borderRadius: '14px' }}>
          {error.message}
        </Alert>
      )}
      <Box sx={{ height: 16 }} />
      <PieAcciones>
        <Button
          variant="contained"
          color="success"
          fullWidth
          disabled={!listo}
          startIcon={<CheckRounded sx={{ fontSize: 28 }} />}
          onClick={() =>
            confirmar.mutate({ captura, nivel, manifestaciones }, { onSuccess: onGuardada })
          }
          sx={{ fontSize: 20, boxShadow: listo ? '0 8px 20px -6px rgba(46,125,50,.45)' : 'none' }}
        >
          {confirmar.isPending ? 'Guardando…' : 'Está bien'}
        </Button>
        <Button
          variant="text"
          startIcon={<DeleteRounded />}
          disabled={ocupado}
          onClick={() => setConfirmandoBorrado(true)}
          sx={{ color: 'text.secondary' }}
        >
          Borrar nota
        </Button>
      </PieAcciones>
      <Dialog
        open={confirmandoBorrado}
        onClose={() => setConfirmandoBorrado(false)}
        aria-labelledby="titulo-borrar-nota"
        aria-describedby="detalle-borrar-nota"
      >
        <DialogTitle id="titulo-borrar-nota" sx={{ fontWeight: 800 }}>
          ¿Borrar la nota?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="detalle-borrar-nota">
            La nota de {nino.nombre} no se guardará y no se puede recuperar.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="text" onClick={() => setConfirmandoBorrado(false)}>
            Volver a la nota
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmandoBorrado(false);
              descartar.mutate(captura, { onSuccess: onBorrada });
            }}
          >
            Borrar
          </Button>
        </DialogActions>
      </Dialog>
    </Pantalla>
  );
}

/** Nivel estimado con botones para bajarlo o subirlo. Se rotula como estimación, no diagnóstico. */
function ElegirNivel({
  nivel,
  niveles,
  onNivel,
}: {
  nivel: number;
  niveles: NivelRuta[];
  onNivel: (nivel: number) => void;
}) {
  const nombre = niveles.find((n) => n.nivel === nivel)?.nombre;
  const minimo = niveles[0]?.nivel ?? 1;
  const maximo = niveles.at(-1)?.nivel ?? 8;
  return (
    <Stack sx={{ gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        Nivel estimado (estimación pedagógica, no un diagnóstico)
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          aria-label="Bajar nivel"
          disabled={nivel <= minimo}
          onClick={() => onNivel(nivel - 1)}
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <RemoveRounded />
        </IconButton>
        <Box role="status" aria-label="Nivel estimado" sx={{ flex: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800 }}>Nivel {nivel}</Typography>
          {nombre && (
            <Typography variant="body2" color="text.secondary">
              {nombre}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label="Subir nivel"
          disabled={nivel >= maximo}
          onClick={() => onNivel(nivel + 1)}
          sx={{ border: 1, borderColor: 'divider' }}
        >
          <AddRounded />
        </IconButton>
      </Box>
    </Stack>
  );
}

/** Manifestaciones del catálogo para el nivel elegido, agrupadas por área. */
function AgregarManifestacion({
  opciones,
  lleno,
  onAgregar,
  onCerrar,
}: {
  opciones: Manifestacion[];
  lleno: boolean;
  onAgregar: (manifestacion: Manifestacion) => void;
  onCerrar: () => void;
}) {
  return (
    <Stack
      component="section"
      aria-label="Catálogo de manifestaciones"
      sx={{ gap: 1, p: 1.5, bgcolor: colores.crema, borderRadius: '12px' }}
    >
      {lleno && (
        <Typography variant="body2" color="text.secondary">
          Puedes elegir hasta {MAXIMO_MANIFESTACIONES} manifestaciones.
        </Typography>
      )}
      {NUCLEOS.map((nucleo) =>
        opciones
          .filter((m) => m.nucleo === nucleo)
          .map((m) => (
            <ButtonBase
              key={m.id}
              disabled={lleno}
              onClick={() => onAgregar(m)}
              sx={{
                p: 1.25,
                gap: 1,
                justifyContent: 'flex-start',
                textAlign: 'left',
                bgcolor: '#fff',
                borderRadius: '12px',
                border: 1,
                borderColor: 'divider',
                opacity: lleno ? 0.5 : 1,
              }}
            >
              <ChipArea area={m.nucleo} compacto />
              <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>
                {m.textoObservable}
              </Box>
            </ButtonBase>
          )),
      )}
      {opciones.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No quedan manifestaciones de este nivel por agregar.
        </Typography>
      )}
      <Box>
        <Button variant="text" onClick={onCerrar} sx={{ color: 'primary.dark', px: 1, ml: -1 }}>
          Listo
        </Button>
      </Box>
    </Stack>
  );
}

function CajaTexto({
  valor,
  onCambio,
  etiqueta,
  autoFocus = false,
}: {
  valor: string;
  onCambio: (valor: string) => void;
  etiqueta: string;
  autoFocus?: boolean;
}) {
  return (
    <InputBase
      multiline
      minRows={4}
      autoFocus={autoFocus}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      inputProps={{ 'aria-label': etiqueta }}
      placeholder="Ej.: Apiló tres bloques y aplaudió."
      sx={{
        width: '100%',
        p: 1.75,
        bgcolor: colores.amarilloSuave,
        border: `2px solid ${colores.amarillo}`,
        borderRadius: '12px',
        fontSize: 17,
        lineHeight: '26px',
      }}
    />
  );
}
