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
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import {
  AvisoVerde,
  CabeceraConCerrar,
  ChipArea,
  Encabezado,
  NinoAvatar,
  Pantalla,
  formatoDuracion,
} from './componentes';
import {
  DOMINIOS,
  NINOS,
  NINOS_DE_MI_SALA,
  SALAS,
  nuevoId,
  simularLectura,
  sugerirArea,
  type Dominio,
  type Formato,
  type Nino,
  type Nota,
} from './datos';
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

/**
 * Flujo «acción primero» (diseño 1b): capturar, elegir al niño o niña y confirmar.
 * La transcripción del audio y la lectura del post-it están simuladas con textos sintéticos.
 * En PC (`escritorio`) la foto y el audio se suben como archivo y se elige entre todas las salas.
 */
export function NuevaNota({
  formato,
  semilla,
  educadora,
  escritorio = false,
  onGuardar,
  onCancelar,
}: {
  formato: Formato;
  /** Rota las lecturas simuladas para que no se repita siempre la misma. */
  semilla: number;
  educadora: string;
  escritorio?: boolean;
  onGuardar: (nota: Nota) => void;
  onCancelar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(
    escritorio && formato !== 'texto' ? 'subir' : ETAPA_INICIAL[formato],
  );
  const [archivo, setArchivo] = useState<string>();
  const [duracion, setDuracion] = useState<number>();
  const [texto, setTexto] = useState('');
  const [sugerencia, setSugerencia] = useState<Nota['sugerencia']>({ texto: '', area: null });
  const [area, setArea] = useState<Dominio | null>(null);
  const [ninoId, setNinoId] = useState<string | null>(null);

  const capturar = (textoLeido: string, areaSugerida: Dominio | null) => {
    setTexto(textoLeido);
    setSugerencia({ texto: textoLeido, area: areaSugerida });
    setArea(areaSugerida);
    setEtapa('nino');
  };

  const ninos = escritorio ? NINOS : NINOS_DE_MI_SALA;
  const nino = ninos.find((n) => n.id === ninoId);

  switch (etapa) {
    case 'grabando':
      return (
        <Grabando
          onCancelar={onCancelar}
          onTerminar={(segundos) => {
            setDuracion(segundos);
            const lectura = simularLectura('audio', semilla);
            capturar(lectura.texto, lectura.area);
          }}
        />
      );
    case 'camara':
      return (
        <Camara
          onCancelar={onCancelar}
          onTomar={() => {
            const lectura = simularLectura('foto', semilla);
            capturar(lectura.texto, lectura.area);
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
          onListo={(nombreArchivo) => {
            setArchivo(nombreArchivo);
            const lectura = simularLectura(formato, semilla);
            capturar(lectura.texto, lectura.area);
          }}
        />
      );
    case 'escribiendo':
      return (
        <Escribiendo
          onCancelar={onCancelar}
          onListo={(escrito) => capturar(escrito, sugerirArea(escrito))}
        />
      );
    case 'nino':
      return (
        <ElegirNino
          aviso={CAPTURA_LISTA[formato]}
          ninos={ninos}
          agrupar={escritorio}
          seleccionado={ninoId}
          onSeleccionar={setNinoId}
          onSeguir={() => setEtapa('revision')}
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
          area={area}
          onArea={setArea}
          onBorrar={onCancelar}
          onConfirmar={() => {
            if (!area) return;
            onGuardar({
              id: nuevoId(),
              ninoId: nino.id,
              educadora,
              formato,
              creada: new Date(),
              duracion,
              texto: texto.trim(),
              area,
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
        <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Toca para terminar</Typography>
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
    ? SALAS.map((sala) => ({ sala, ninos: ninos.filter((n) => n.sala === sala) }))
    : [{ sala: null, ninos }];
  return (
    <Pantalla>
      <CabeceraConCerrar
        titulo="¿De quién es?"
        subtitulo="Toca un niño o niña"
        onCancelar={onCancelar}
      />
      <Box sx={{ px: 2, pt: 1.75 }}>
        <AvisoVerde icono={<CheckCircleRounded />}>{aviso}</AvisoVerde>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {grupos.map((grupo) => (
          <Box key={grupo.sala ?? 'sala'} component="section" aria-label={grupo.sala ?? undefined}>
            {grupo.sala && (
              <Typography
                variant="h2"
                color="text.secondary"
                sx={{ px: 2.5, pt: 2, textTransform: 'uppercase' }}
              >
                {grupo.sala}
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
  area,
  onArea,
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
  area: Dominio | null;
  onArea: (area: Dominio) => void;
  onConfirmar: () => void;
  onBorrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [cambiandoArea, setCambiandoArea] = useState(area === null);
  const listo = texto.trim() !== '' && area !== null;

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

        <Stack sx={{ gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {area ? 'Área sugerida' : 'Elige un área'}
          </Typography>
          {cambiandoArea ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {DOMINIOS.map((d) => (
                <ChipArea
                  key={d}
                  area={d}
                  seleccionada={d === area}
                  onClick={() => {
                    onArea(d);
                    setCambiandoArea(false);
                  }}
                />
              ))}
            </Box>
          ) : (
            area && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <ChipArea area={area} />
                <Button
                  variant="text"
                  onClick={() => setCambiandoArea(true)}
                  sx={{ color: 'primary.dark', fontSize: 15, minHeight: 40, px: 1 }}
                >
                  Cambiar
                </Button>
              </Box>
            )
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
