import { useEffect, useState, type ReactNode } from 'react';
import { keyframes } from '@emotion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import { etiquetaSala, type Manifestacion, type NivelRuta } from './api';
import {
  AvisoVerde,
  CabeceraConCerrar,
  ChipArea,
  Encabezado,
  NinoAvatar,
  Pantalla,
} from './componentes';
import { formatoDuracion } from './formato';
import {
  DOMINIOS,
  nuevoId,
  simularLectura,
  type Formato,
  type ManifestacionCitada,
  type Nino,
  type Nota,
} from './datos';
import { nivelEsperado, proponer } from './propuesta';
import { SubirArchivo } from './SubirArchivo';
import { colores } from './tema';

type Etapa = 'grabando' | 'camara' | 'subir' | 'escribiendo' | 'nino' | 'revision';

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
 * Flujo «acción primero» (diseño 1b): capturar, elegir al niño o niña y confirmar.
 * La transcripción del audio, la lectura del post-it y la propuesta de nivel y manifestaciones
 * están simuladas (`propuesta.ts`), pero usan el catálogo y los niveles reales de la API.
 * En PC (`escritorio`) la foto y el audio se suben como archivo y se elige entre todas las salas.
 * Con `ninoFijo` (desde la ficha del niño o niña) la nota ya tiene dueño y se salta la elección.
 */
export function NuevaNota({
  formato,
  semilla,
  educadora,
  escritorio = false,
  ninos,
  ninoFijo,
  catalogo,
  onGuardar,
  onCancelar,
}: {
  formato: Formato;
  /** Rota las lecturas simuladas para que no se repita siempre la misma. */
  semilla: number;
  educadora: string;
  escritorio?: boolean;
  /** Niños y niñas que se ofrecen en «¿De quién es?». */
  ninos: Nino[];
  /** Niño o niña ya elegido: la nota se le asocia sin pasar por «¿De quién es?». */
  ninoFijo?: Nino;
  catalogo: { niveles: NivelRuta[]; manifestaciones: Manifestacion[] };
  onGuardar: (nota: Nota) => void;
  onCancelar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(
    escritorio && formato !== 'texto' ? 'subir' : ETAPA_INICIAL[formato],
  );
  const [archivo, setArchivo] = useState<string>();
  const [duracion, setDuracion] = useState<number>();
  const [texto, setTexto] = useState('');
  const [sugerencia, setSugerencia] = useState<Nota['sugerencia']>({
    nivel: null,
    manifestaciones: [],
  });
  const [nivel, setNivel] = useState(1);
  const [manifestaciones, setManifestaciones] = useState<ManifestacionCitada[]>([]);
  const [ninoId, setNinoId] = useState<string | null>(ninoFijo?.id ?? null);

  const nino = ninoFijo ?? ninos.find((n) => n.id === ninoId);

  /** Pide la propuesta (simulada) para el niño o niña y el texto, y pasa a la revisión. */
  const revisar = (para: Nino, textoLeido: string) => {
    const propuesta = proponer(
      textoLeido,
      para.edadMeses,
      catalogo.niveles,
      catalogo.manifestaciones,
    );
    setSugerencia({
      nivel: propuesta.nivel,
      manifestaciones: propuesta.manifestaciones.map((m) => m.manifestacion.id),
    });
    setNivel(propuesta.nivel ?? nivelEsperado(para.edadMeses, catalogo.niveles));
    setManifestaciones(propuesta.manifestaciones);
    setEtapa('revision');
  };

  const capturar = (textoLeido: string) => {
    setTexto(textoLeido);
    if (ninoFijo) revisar(ninoFijo, textoLeido);
    else setEtapa('nino');
  };

  switch (etapa) {
    case 'grabando':
      return (
        <Grabando
          onCancelar={onCancelar}
          onTerminar={(segundos) => {
            setDuracion(segundos);
            capturar(simularLectura('audio', semilla));
          }}
        />
      );
    case 'camara':
      return (
        <Camara onCancelar={onCancelar} onTomar={() => capturar(simularLectura('foto', semilla))} />
      );
    case 'subir':
      if (formato === 'texto') return null;
      return (
        <SubirArchivo
          tipo={formato}
          onCancelar={onCancelar}
          onGrabar={formato === 'audio' ? () => setEtapa('grabando') : undefined}
          onListo={(nombreArchivo) => {
            setArchivo(nombreArchivo);
            capturar(simularLectura(formato, semilla));
          }}
        />
      );
    case 'escribiendo':
      return <Escribiendo onCancelar={onCancelar} onListo={capturar} />;
    case 'nino':
      return (
        <ElegirNino
          aviso={CAPTURA_LISTA[formato]}
          ninos={ninos}
          agrupar={escritorio}
          seleccionado={ninoId}
          onSeleccionar={setNinoId}
          onSeguir={() => nino && revisar(nino, texto)}
          onCancelar={onCancelar}
        />
      );
    case 'revision':
      if (!nino) return null;
      return (
        <Revision
          formato={formato}
          ninoNombre={nino.nombre}
          avatar={<NinoAvatar nino={nino} tamano={formato === 'foto' ? 32 : 40} />}
          duracion={duracion}
          archivo={archivo}
          texto={texto}
          onTexto={setTexto}
          nivel={nivel}
          onNivel={(n) => {
            setNivel(n);
            // La API exige que todas las manifestaciones sean del nivel confirmado.
            setManifestaciones((previas) => previas.filter((m) => m.manifestacion.nivel === n));
          }}
          niveles={catalogo.niveles}
          manifestaciones={manifestaciones}
          onManifestaciones={setManifestaciones}
          catalogo={catalogo.manifestaciones}
          evidenciaInsuficiente={sugerencia.nivel === null}
          onBorrar={onCancelar}
          onConfirmar={() => {
            if (manifestaciones.length === 0) return;
            onGuardar({
              id: nuevoId(),
              nino,
              educadora,
              formato,
              creada: new Date(),
              duracion,
              texto: texto.trim(),
              nivel,
              manifestaciones,
              sugerencia,
            });
          }}
        />
      );
  }
}

const onda = keyframes`
  0%, 100% { transform: scaleY(.45); }
  50% { transform: scaleY(1); }
`;

const BARRAS = [20, 38, 56, 30, 48, 24, 42, 18];

function Grabando({
  onTerminar,
  onCancelar,
}: {
  onTerminar: (segundos: number) => void;
  onCancelar: () => void;
}) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <Pantalla>
      <Encabezado titulo="Nota de audio" />
      <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2.75 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontWeight: 800,
            color: 'primary.dark',
          }}
        >
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
          Grabando
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
                animation: `${onda} ${0.8 + (i % 4) * 0.15}s ease-in-out infinite`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
          ))}
        </Box>
        <ButtonBase
          aria-label="Terminar grabación"
          onClick={() => onTerminar(Math.max(segundos, 1))}
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            boxShadow: `0 0 0 14px ${colores.rojoSuave}, 0 10px 30px -4px rgba(214,40,57,.4)`,
          }}
        >
          <Box sx={{ width: 38, height: 38, borderRadius: '8px', bgcolor: '#fff' }} />
        </ButtonBase>
        <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Presiona para terminar</Typography>
        <Typography variant="caption" color="text.secondary">
          Demo: la grabación es simulada, no se usa el micrófono.
        </Typography>
      </Stack>
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

function Camara({ onTomar, onCancelar }: { onTomar: () => void; onCancelar: () => void }) {
  return (
    <Pantalla oscura>
      <Box
        sx={{
          px: 1.5,
          pt: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <IconButton aria-label="Cancelar" onClick={onCancelar} sx={{ color: '#fff' }}>
          <CloseRounded sx={{ fontSize: 30 }} />
        </IconButton>
        <Typography component="h1" sx={{ fontSize: 17, fontWeight: 700 }}>
          Foto del post-it
        </Typography>
        <Box sx={{ width: 46 }} />
      </Box>
      <Box
        sx={{
          flex: 1,
          minHeight: 280,
          mx: 2.5,
          my: 1.5,
          borderRadius: '20px',
          background: 'repeating-linear-gradient(135deg,#2e2118 0 10px,#35271d 10px 20px)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Box
          sx={{
            width: 200,
            height: 200,
            border: `3px dashed ${colores.amarillo}`,
            borderRadius: '16px',
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            font: '600 12px ui-monospace, Menlo, monospace',
            color: '#e4c36f',
          }}
        >
          cámara simulada
          <br />
          (post-it)
        </Box>
      </Box>
      <Typography sx={{ textAlign: 'center', fontSize: 17, fontWeight: 700, px: 2.5 }}>
        Pon el post-it dentro del cuadro
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2.5, pb: 4 }}>
        <ButtonBase
          aria-label="Tomar foto"
          onClick={onTomar}
          sx={{
            width: 84,
            height: 84,
            borderRadius: '50%',
            bgcolor: '#fff',
            boxShadow: '0 0 0 6px rgba(255,255,255,.3)',
          }}
        />
      </Box>
    </Pantalla>
  );
}

function Escribiendo({
  onListo,
  onCancelar,
}: {
  onListo: (texto: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState('');
  return (
    <Pantalla>
      <CabeceraConCerrar titulo="Escribe tu nota" onCancelar={onCancelar} />
      <Box sx={{ px: 2, pt: 2 }}>
        <CajaTexto valor={texto} onCambio={setTexto} autoFocus etiqueta="Texto de la nota" />
      </Box>
      <Box sx={{ mt: 'auto', px: 2, pt: 2, pb: 3.5 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!texto.trim()}
          endIcon={<ArrowForwardRounded />}
          onClick={() => onListo(texto.trim())}
        >
          Listo
        </Button>
      </Box>
    </Pantalla>
  );
}

function ElegirNino({
  aviso,
  ninos,
  agrupar,
  seleccionado,
  onSeleccionar,
  onSeguir,
  onCancelar,
}: {
  aviso: string;
  ninos: Nino[];
  /** En PC se muestran todas las salas, cada una con su título. */
  agrupar: boolean;
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  onSeguir: () => void;
  onCancelar: () => void;
}) {
  const elegido = ninos.find((n) => n.id === seleccionado);
  const grupos = agrupar
    ? [...new Set(ninos.map((n) => n.sala))]
        .sort()
        .map((sala) => ({ sala, ninos: ninos.filter((n) => n.sala === sala) }))
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
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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
      <Box sx={{ mt: 'auto', px: 2, pt: 1, pb: 3.5 }}>
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
      </Box>
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

function Revision({
  formato,
  ninoNombre,
  avatar,
  duracion,
  archivo,
  texto,
  onTexto,
  nivel,
  onNivel,
  niveles,
  manifestaciones,
  onManifestaciones,
  catalogo,
  evidenciaInsuficiente,
  onConfirmar,
  onBorrar,
}: {
  formato: Formato;
  ninoNombre: string;
  avatar: ReactNode;
  duracion?: number;
  archivo?: string;
  texto: string;
  onTexto: (texto: string) => void;
  nivel: number;
  onNivel: (nivel: number) => void;
  niveles: NivelRuta[];
  manifestaciones: ManifestacionCitada[];
  onManifestaciones: (manifestaciones: ManifestacionCitada[]) => void;
  catalogo: Manifestacion[];
  /** La propuesta no encontró evidencia: la educadora elige las manifestaciones. */
  evidenciaInsuficiente: boolean;
  onConfirmar: () => void;
  onBorrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [agregando, setAgregando] = useState(evidenciaInsuficiente);
  const listo = texto.trim() !== '' && manifestaciones.length > 0;

  return (
    <Pantalla>
      <Encabezado titulo="¿Está bien?" subtitulo={SUBTITULO_REVISION[formato]} />
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
          {formato === 'foto' && (
            <Box
              aria-hidden
              sx={{
                width: 64,
                height: 64,
                flexShrink: 0,
                borderRadius: '10px',
                background: `repeating-linear-gradient(135deg,${colores.amarilloSuave} 0 6px,${colores.amarillo} 6px 12px)`,
                display: 'grid',
                placeItems: 'center',
                font: '600 9px ui-monospace, Menlo, monospace',
                color: '#594400',
              }}
            >
              post-it
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
            {avatar}
            <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{ninoNombre}</Typography>
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

        {archivo && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              color: 'text.secondary',
              fontSize: 14,
              fontWeight: 600,
              minWidth: 0,
            }}
          >
            <AttachFileRounded sx={{ fontSize: 20 }} />
            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {archivo}
            </Box>
          </Box>
        )}
        {editando ? (
          <CajaTexto valor={texto} onCambio={onTexto} autoFocus etiqueta="Corregir texto" />
        ) : (
          <Box
            sx={{
              p: 1.75,
              bgcolor: colores.amarilloSuave,
              borderRadius: '12px',
              fontSize: 17,
              lineHeight: '26px',
            }}
          >
            {texto}
          </Box>
        )}
        <Box>
          <Button
            variant="text"
            startIcon={editando ? <CheckRounded /> : <EditRounded />}
            onClick={() => setEditando(!editando)}
            sx={{ color: 'primary.dark', fontSize: 15, minHeight: 40, px: 1, ml: -1 }}
          >
            {editando ? 'Listo' : 'Corregir texto'}
          </Button>
        </Box>

        <Box sx={{ height: '1px', bgcolor: 'divider' }} />

        <ElegirNivel nivel={nivel} niveles={niveles} onNivel={onNivel} />

        <Stack sx={{ gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {evidenciaInsuficiente ? 'Elige lo que observaste' : 'Lo que observaste'}
          </Typography>
          {evidenciaInsuficiente && manifestaciones.length === 0 && (
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
                  <ChipArea area={manifestacion.dominio} compacto />
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: '22px' }}>
                  {manifestacion.textoObservable}
                </Typography>
                {cita && (
                  <Typography variant="body2" color="text.secondary">
                    «{cita}»
                  </Typography>
                )}
              </Stack>
              <IconButton
                aria-label={`Quitar «${manifestacion.textoObservable}»`}
                onClick={() =>
                  onManifestaciones(
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
              opciones={catalogo.filter(
                (m) =>
                  m.nivel === nivel &&
                  !manifestaciones.some((elegida) => elegida.manifestacion.id === m.id),
              )}
              lleno={manifestaciones.length >= MAXIMO_MANIFESTACIONES}
              onAgregar={(m) =>
                onManifestaciones([...manifestaciones, { manifestacion: m, cita: null }])
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

      <Stack sx={{ mt: 'auto', px: 2, pt: 2, pb: 3.5, gap: 0.75 }}>
        <Button
          variant="contained"
          color="success"
          fullWidth
          disabled={!listo}
          startIcon={<CheckRounded sx={{ fontSize: 28 }} />}
          onClick={onConfirmar}
          sx={{ fontSize: 20, boxShadow: listo ? '0 8px 20px -6px rgba(46,125,50,.45)' : 'none' }}
        >
          Está bien
        </Button>
        <Button
          variant="text"
          startIcon={<DeleteRounded />}
          onClick={onBorrar}
          sx={{ color: 'text.secondary' }}
        >
          Borrar nota
        </Button>
      </Stack>
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
  const maximo = niveles.at(-1)?.nivel ?? 9;
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
      {DOMINIOS.map((dominio) =>
        opciones
          .filter((m) => m.dominio === dominio)
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
              <ChipArea area={m.dominio} compacto />
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
