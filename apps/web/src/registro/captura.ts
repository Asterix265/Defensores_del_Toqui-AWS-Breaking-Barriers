/**
 * Captura en el navegador: grabación con el micrófono y preparación de la foto. Los tipos
 * aceptados son los mismos que valida la API (`TIPOS_ARCHIVO` en `@toqui/shared`).
 */

export const TIPOS_AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
export const TIPOS_FOTO = ['image/jpeg', 'image/png'];
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

/** Lado mayor de la foto convertida: suficiente para leer un post-it y liviana para subir. */
const LADO_MAXIMO_FOTO = 2000;

/** Claude en Bedrock lee imágenes de hasta 3,75 MB: las fotos más pesadas se reducen. */
export const TAMANO_MAXIMO_FOTO = 3.75 * 1024 * 1024;

/** «audio/webm;codecs=opus» → «audio/webm». La firma de S3 lleva el tipo sin parámetros. */
export function tipoBase(tipo: string): string {
  return tipo.split(';')[0]!.trim().toLowerCase();
}

export interface Grabacion {
  /** Termina la grabación y entrega el audio. */
  detener: () => Promise<Blob>;
  /** Suelta el micrófono sin entregar nada. */
  cancelar: () => void;
}

/** Pide el micrófono y empieza a grabar en el primer formato que la API acepta y el navegador soporta. */
export async function iniciarGrabacion(): Promise<Grabacion> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Este navegador no permite grabar audio.');
  }
  const tipo = TIPOS_AUDIO.find((t) => MediaRecorder.isTypeSupported(t));
  if (!tipo) throw new Error('Este navegador no graba en un formato que la app acepte.');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const soltar = () => stream.getTracks().forEach((pista) => pista.stop());
  const grabador = new MediaRecorder(stream, { mimeType: tipo });
  const partes: Blob[] = [];
  grabador.ondataavailable = (e) => {
    if (e.data.size > 0) partes.push(e.data);
  };
  grabador.start();

  return {
    detener: () =>
      new Promise((resolver) => {
        grabador.onstop = () => {
          soltar();
          resolver(new Blob(partes, { type: tipoBase(grabador.mimeType || tipo) }));
        };
        grabador.stop();
      }),
    cancelar: () => {
      grabador.onstop = soltar;
      if (grabador.state !== 'inactive') grabador.stop();
      else soltar();
    },
  };
}

/** Explica por qué no se pudo grabar, en palabras de la educadora. */
export function motivoMicrofono(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'El navegador no dio permiso para usar el micrófono.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No se encontró un micrófono en este dispositivo.';
  }
  return error instanceof Error ? error.message : 'No se pudo usar el micrófono.';
}

/**
 * Deja la foto en JPEG o PNG de hasta 3,75 MB, lo que Claude puede leer. Si viene en otro
 * formato (HEIC, WebP) o es más pesada, la redibuja como JPEG; si el navegador no puede leerla,
 * avisa.
 */
export async function prepararFoto(archivo: File): Promise<File> {
  const tipo = tipoBase(archivo.type);
  if (TIPOS_FOTO.includes(tipo) && archivo.size <= TAMANO_MAXIMO_FOTO) return archivo;

  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    throw new Error('No se pudo leer esa imagen. Usa una foto JPEG o PNG.');
  }
  const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  const jpeg = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, 'image/jpeg', 0.85),
  );
  if (!jpeg) throw new Error('No se pudo convertir la foto a JPEG.');
  const nombre = archivo.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([jpeg], `${nombre}.jpg`, { type: 'image/jpeg' });
}

/** «48213» → «47 KB». */
export function formatoBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
