import { useRef, useState, type DragEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import {
  TAMANO_MAXIMO,
  TIPOS_AUDIO,
  TIPOS_FOTO,
  formatoBytes,
  prepararFoto,
  tipoBase,
} from './captura';
import { AvisoVerde, CabeceraConCerrar, Pantalla, PieAcciones } from './componentes';
import { colores } from './tema';

const CONFIG = {
  foto: {
    titulo: 'Sube la foto del post-it',
    acepta: 'image/*',
    tipos: TIPOS_FOTO,
    Icono: PhotoCameraRounded,
    indicacion: 'Arrastra aquí la foto',
    error: 'Ese archivo no es una imagen.',
  },
  audio: {
    titulo: 'Sube el audio',
    acepta: TIPOS_AUDIO.join(','),
    tipos: TIPOS_AUDIO,
    Icono: MicRounded,
    indicacion: 'Arrastra aquí el audio',
    error: 'Ese audio no se puede usar: sube WebM, OGG, M4A, MP3 o WAV.',
  },
} as const;

/**
 * Captura en PC: en vez de la cámara o el micrófono, se sube un archivo (o se arrastra).
 * La foto se convierte a JPEG si hace falta; el archivo se sube a S3 al elegir al niño o niña.
 */
export function SubirArchivo({
  tipo,
  onListo,
  onGrabar,
  onCancelar,
}: {
  tipo: 'foto' | 'audio';
  onListo: (archivo: File) => void;
  /** Solo audio: alternativa de grabar con el micrófono del PC. */
  onGrabar?: () => void;
  onCancelar: () => void;
}) {
  const config = CONFIG[tipo];
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const selector = useRef<HTMLInputElement>(null);

  const elegir = async (elegido: File | undefined) => {
    if (!elegido) return;
    setArchivo(null);
    try {
      if (tipo === 'foto') {
        if (!elegido.type.startsWith('image/')) throw new Error(config.error);
        setArchivo(await prepararFoto(elegido));
      } else {
        if (!config.tipos.includes(tipoBase(elegido.type))) throw new Error(config.error);
        if (elegido.size > TAMANO_MAXIMO) {
          throw new Error(`El audio pesa ${formatoBytes(elegido.size)}; el máximo es 10 MB.`);
        }
        setArchivo(elegido);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : config.error);
    }
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setEncima(false);
    void elegir(e.dataTransfer.files[0]);
  };

  return (
    <Pantalla>
      <CabeceraConCerrar titulo={config.titulo} onCancelar={onCancelar} />
      <Stack sx={{ px: 2, pt: 2, gap: 1.5 }}>
        <Box
          onDragOver={(e) => {
            e.preventDefault();
            setEncima(true);
          }}
          onDragLeave={() => setEncima(false)}
          onDrop={soltar}
          sx={{
            minHeight: 240,
            p: 3,
            borderRadius: '24px',
            border: `3px dashed ${encima ? colores.rojo : colores.amarillo}`,
            bgcolor: encima ? colores.amarilloSuave : '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              bgcolor: colores.amarilloSuave,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <config.Icono sx={{ fontSize: 36, color: colores.amarilloTinta }} />
          </Box>
          <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{config.indicacion}</Typography>
          <Typography variant="caption" color="text.secondary">
            o
          </Typography>
          <Button
            variant="outlined"
            startIcon={<UploadFileRounded />}
            onClick={() => selector.current?.click()}
            sx={{ minHeight: 48, px: 3, fontSize: 16 }}
          >
            Elegir archivo
          </Button>
          <input
            ref={selector}
            type="file"
            accept={config.acepta}
            aria-label="Archivo"
            hidden
            onChange={(e) => void elegir(e.target.files?.[0])}
          />
        </Box>
        {archivo && <AvisoVerde icono={<CheckCircleRounded />}>{archivo.name}</AvisoVerde>}
        {error && (
          <Alert severity="error" sx={{ borderRadius: '14px' }}>
            {error}
          </Alert>
        )}
        {onGrabar && (
          <Box>
            <Button
              variant="text"
              startIcon={<MicRounded />}
              onClick={onGrabar}
              sx={{ color: 'primary.dark', ml: -1 }}
            >
              Prefiero grabar ahora
            </Button>
          </Box>
        )}
      </Stack>
      <PieAcciones>
        <Button
          variant="contained"
          fullWidth
          disabled={!archivo}
          endIcon={<ArrowForwardRounded />}
          onClick={() => archivo && onListo(archivo)}
        >
          Seguir
        </Button>
      </PieAcciones>
    </Pantalla>
  );
}
