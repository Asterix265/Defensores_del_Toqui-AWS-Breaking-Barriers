/**
 * Fixtures sintéticos y servidor MSW para las pruebas de «Registro Simple».
 * Los nombres e IDs son inventados para las pruebas; no salen del dataset.
 */
import { StrictMode, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { getGetMeMockHandler } from '../api/generated/auth/auth.msw';
import {
  getListarManifestacionesMockHandler,
  getListarNivelesMockHandler,
} from '../api/generated/catalogo/catalogo.msw';
import {
  getListarNinosMockHandler,
  getObtenerTrayectoriaMockHandler,
} from '../api/generated/ninos/ninos.msw';
import type {
  CapturaDetalleDtoOutput,
  CapturaResumenOutput,
  ManifestacionDtoOutput,
  NinoDtoOutput,
  ObservacionTrayectoriaOutput,
  TrayectoriaResponseDtoOutput,
} from '../api/generated/model';
import { tema } from './tema';

const DOMINIOS = {
  MG: 'motor_grueso',
  MF: 'motor_fino',
  LC: 'lenguaje_comunicacion',
  SE: 'socioemocional',
  CO: 'cognitivo',
} as const;

const RANGOS = [
  [0, 2],
  [2, 4],
  [4, 7],
  [7, 10],
  [10, 13],
  [13, 18],
  [18, 24],
  [24, 30],
  [30, 36],
] as const;

export const NIVELES = RANGOS.map(([edadMinMeses, edadMaxMeses], i) => ({
  nivel: i + 1,
  nombre: `Nivel de prueba ${i + 1}`,
  edadMinMeses,
  edadMaxMeses,
}));

/** Una manifestación por nivel y dominio: «Prueba MF 7», etc. */
export const MANIFESTACIONES: ManifestacionDtoOutput[] = NIVELES.flatMap(({ nivel }) =>
  Object.entries(DOMINIOS).map(([codigo, dominio]) => ({
    id: `MAN-L${String(nivel).padStart(2, '0')}-${codigo}-01`,
    nivel,
    dominio,
    textoObservable: `Prueba ${codigo} ${nivel}`,
  })),
);

const manifestacion = (id: string) => MANIFESTACIONES.find((m) => m.id === id)!;

function nino(id: string, nombres: string, apellidos: string, sala: string, edadMeses: number) {
  return { id, nombres, apellidos, sala, fechaNacimiento: '2024-01-01', edadMeses };
}

/** Sala A: Martina, Benjamín y Tomás (20 meses → nivel 7). Sala B: Vicente (31 meses → nivel 9). */
export const NINOS: NinoDtoOutput[] = [
  nino('NINO-T001', 'Martina', 'Pérez Soto', 'SG-A', 20),
  nino('NINO-T002', 'Benjamín', 'Soto Rojas', 'SG-A', 20),
  nino('NINO-T003', 'Tomás', 'Araya Díaz', 'SG-A', 20),
  nino('NINO-T004', 'Vicente', 'Pizarro Vera', 'SG-B', 31),
];

function haceDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function observacion(
  id: string,
  dias: number,
  idManifestacion: string,
  notaBreve: string | null = null,
): ObservacionTrayectoriaOutput {
  return {
    id,
    fecha: haceDias(dias),
    formato: 'texto',
    origen: 'dataset',
    nivelEstimado: 7,
    notaBreve,
    manifestaciones: [manifestacion(idManifestacion)],
  };
}

/** Martina tiene registros recientes en cuatro áreas y ninguno de Motor grueso. */
function observacionesIniciales(): Record<string, ObservacionTrayectoriaOutput[]> {
  return {
    'NINO-T001': [
      observacion('OBS-T1', 1, 'MAN-L07-LC-01', 'Registro durante el juego libre.'),
      observacion('OBS-T2', 3, 'MAN-L07-SE-01'),
      observacion('OBS-T3', 6, 'MAN-L07-CO-01'),
      observacion('OBS-T4', 12, 'MAN-L07-MF-01'),
    ],
  };
}

let OBSERVACIONES = observacionesIniciales();
const CAPTURAS = new Map<string, CapturaDetalleDtoOutput>();
const SUBIDAS = new Set<string>();

/** Capturas creadas en la API falsa. */
export function capturasCreadas() {
  return [...CAPTURAS.values()];
}

/** Vuelve la API falsa a su estado inicial (llamar después de cada prueba). */
export function reiniciarApi() {
  OBSERVACIONES = observacionesIniciales();
  CAPTURAS.clear();
  SUBIDAS.clear();
}

/** Textos de ejemplo que devuelve la API falsa para audio y foto, como el proveedor `fake`. */
export const EJEMPLO_AUDIO = 'Buscó el autito que tapé con el pañal y dijo «agua».';
export const EJEMPLO_FOTO = 'Apiló 4 bloques de espuma solo y aplaudió.';

const EXTENSION: Record<string, string> = { 'audio/webm': 'webm', 'image/jpeg': 'jpg' };

function nivelDe(edadMeses: number): number {
  return NIVELES.find((n) => edadMeses >= n.edadMinMeses && edadMeses < n.edadMaxMeses)?.nivel ?? 9;
}

/** Borrador como el del pipeline inline: «bloques» → Motor fino; «dijo» → Lenguaje. */
function borradorDe(c: CapturaDetalleDtoOutput, bytes: number, clave: string | null) {
  const texto =
    c.formato === 'audio' ? EJEMPLO_AUDIO : c.formato === 'foto' ? EJEMPLO_FOTO : c.texto!;
  const nivel = nivelDe(NINOS.find((n) => n.id === c.nino.id)!.edadMeses);
  const codigo = /bloques/i.test(texto) ? 'MF' : /dijo/i.test(texto) ? 'LC' : null;
  const pasos = [
    ...(c.formato === 'audio'
      ? [
          {
            paso: 'transcripcion' as const,
            estado: 'no_implementado' as const,
            detalle: 'Se usa un texto de ejemplo.',
          },
        ]
      : []),
    ...(c.formato === 'foto'
      ? [
          {
            paso: 'lectura_imagen' as const,
            estado: 'no_implementado' as const,
            detalle: 'Se usa un texto de ejemplo.',
          },
        ]
      : []),
    { paso: 'extraccion' as const, estado: 'simulado' as const, detalle: 'IA simulada.' },
  ];
  return {
    textoFuente: texto,
    nivelSugerido: codigo ? nivel : null,
    evidenciaInsuficiente: !codigo,
    proveedor: 'fake',
    manifestaciones: codigo
      ? [
          {
            manifestacion: manifestacion(`MAN-L${String(nivel).padStart(2, '0')}-${codigo}-01`),
            cita: texto,
          },
        ]
      : [],
    procesamiento: {
      simulado: true,
      entrada: {
        formato: c.formato,
        tipoArchivo: clave ? (c.formato === 'audio' ? 'audio/webm' : 'image/jpeg') : null,
        bytes,
        claveS3: clave,
      },
      pasos,
    },
  };
}

function aResumen(c: CapturaDetalleDtoOutput): CapturaResumenOutput {
  const fuente = c.observacion?.manifestaciones ?? c.borrador?.manifestaciones ?? [];
  return {
    id: c.id,
    nino: c.nino,
    autor: c.autor,
    formato: c.formato,
    estado: c.estado,
    creadoEn: c.creadoEn,
    extracto: c.texto ?? c.borrador?.textoFuente ?? null,
    dominios: [...new Set(fuente.map((m) => m.manifestacion.dominio))],
    nivel: c.observacion?.nivelEstimado ?? null,
  };
}

/** Flujo de capturas en memoria: crear, subir a S3, avisar, consultar, confirmar y descartar. */
const handlersCapturas = [
  http.post('*/capturas', async ({ request }) => {
    const cuerpo = (await request.json()) as {
      idNino: string;
      formato: 'texto' | 'audio' | 'foto';
      texto?: string;
      archivo?: { tipo: string; tamano: number };
    };
    const nino = NINOS.find((n) => n.id === cuerpo.idNino)!;
    const id = `00000000-0000-4000-8000-${String(CAPTURAS.size + 1).padStart(12, '0')}`;
    const captura: CapturaDetalleDtoOutput = {
      id,
      nino: { id: nino.id, nombres: nino.nombres, apellidos: nino.apellidos, sala: nino.sala },
      autor: 'Educadora local',
      formato: cuerpo.formato,
      estado: 'procesando',
      creadoEn: new Date().toISOString(),
      texto: cuerpo.texto ?? null,
      tieneArchivo: Boolean(cuerpo.archivo),
      errorDetalle: null,
      borrador: null,
      observacion: null,
    };
    if (!cuerpo.archivo) {
      captura.borrador = borradorDe(captura, cuerpo.texto!.length, null);
      captura.estado = 'borrador_listo';
    }
    CAPTURAS.set(id, captura);
    const subida = cuerpo.archivo && {
      url: `https://s3.prueba/capturas/${id}.${EXTENSION[cuerpo.archivo.tipo]}`,
      metodo: 'PUT' as const,
      cabeceras: { 'Content-Type': cuerpo.archivo.tipo },
      expiraEn: new Date().toISOString(),
    };
    return HttpResponse.json({ captura, subida: subida ?? null }, { status: 201 });
  }),
  http.put('https://s3.prueba/capturas/:archivo', async ({ request, params }) => {
    const bytes = (await request.arrayBuffer()).byteLength;
    SUBIDAS.add(`${String(params['archivo']).split('.')[0]}:${bytes}`);
    return new HttpResponse(null, { status: 200 });
  }),
  http.post('*/capturas/:id/subida', ({ params }) => {
    const captura = CAPTURAS.get(String(params['id']))!;
    const subida = [...SUBIDAS].find((s) => s.startsWith(`${captura.id}:`));
    if (!subida) {
      return HttpResponse.json({ message: 'El archivo aún no está en S3' }, { status: 409 });
    }
    if (!captura.borrador) {
      const extension = captura.formato === 'audio' ? 'webm' : 'jpg';
      captura.borrador = borradorDe(
        captura,
        Number(subida.split(':')[1]),
        `capturas/${captura.id}.${extension}`,
      );
      captura.estado = 'borrador_listo';
    }
    return HttpResponse.json(captura);
  }),
  http.get('*/capturas/:id', ({ params }) => HttpResponse.json(CAPTURAS.get(String(params['id'])))),
  http.post('*/capturas/:id/confirmacion', async ({ params, request }) => {
    const captura = CAPTURAS.get(String(params['id']))!;
    const cuerpo = (await request.json()) as {
      nivel: number;
      manifestaciones: { idManifestacion: string; cita?: string }[];
    };
    const manifestaciones = cuerpo.manifestaciones.map((m) => manifestacion(m.idManifestacion));
    captura.estado = 'confirmada';
    captura.observacion = {
      id: `APP-${captura.id}`,
      fecha: haceDias(0),
      nivelEstimado: cuerpo.nivel,
      manifestaciones: cuerpo.manifestaciones.map((m, i) => ({
        manifestacion: manifestaciones[i]!,
        cita: m.cita ?? null,
      })),
    };
    OBSERVACIONES[captura.nino.id] = [
      {
        id: `APP-${captura.id}`,
        fecha: haceDias(0),
        formato: captura.formato,
        origen: 'app',
        nivelEstimado: cuerpo.nivel,
        notaBreve: captura.texto,
        manifestaciones,
      },
      ...(OBSERVACIONES[captura.nino.id] ?? []),
    ];
    return HttpResponse.json(captura);
  }),
  http.post('*/capturas/:id/descarte', ({ params }) => {
    const captura = CAPTURAS.get(String(params['id']))!;
    captura.estado = 'descartada';
    return HttpResponse.json(captura);
  }),
  http.get('*/capturas', ({ request }) => {
    const estado = new URL(request.url).searchParams.get('estado');
    const items = [...CAPTURAS.values()]
      .filter((c) => !estado || c.estado === estado)
      .reverse()
      .map(aResumen);
    return HttpResponse.json({ items, total: items.length, pagina: 1, tamano: 100 });
  }),
];

/**
 * Micrófono falso: `MediaRecorder` entrega un audio WebM de 5 bytes. Con `permitir: false`, el
 * navegador niega el permiso como lo haría si la educadora lo rechaza.
 */
export function instalarMicrofono({ permitir = true } = {}) {
  const stream = { getTracks: () => [{ stop: () => undefined }] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () =>
        permitir
          ? Promise.resolve(stream)
          : Promise.reject(new DOMException('Permiso denegado', 'NotAllowedError')),
    },
  });
  class GrabadorFalso {
    static isTypeSupported = (tipo: string) => tipo === 'audio/webm';
    mimeType = 'audio/webm;codecs=opus';
    state = 'inactive';
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
      this.onstop?.();
    }
  }
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: GrabadorFalso });
}

function trayectoria(idNino: string): TrayectoriaResponseDtoOutput {
  const datos = NINOS.find((n) => n.id === idNino)!;
  const observaciones = OBSERVACIONES[idNino] ?? [];
  return {
    nino: datos,
    desde: haceDias(1000),
    hasta: haceDias(0),
    totalObservaciones: observaciones.length,
    evidenciaLimitada: observaciones.length < 3,
    dominios: Object.values(DOMINIOS).map((dominio) => ({
      dominio,
      sinRegistros: true,
      puntos: [],
    })),
    observaciones,
  };
}

/** Educadora sintética que responde `GET /me`; el token no trae nombre, solo el correo. */
export const EDUCADORA = {
  id: 'edu-prueba-1',
  email: 'mercedes@integra.cl',
  nombre: null,
  grupo: 'educadora' as const,
  idJardin: 'JAR-0001',
};

/** Clave del ingreso en modo local (sin Cognito), la que usan las pruebas. */
export const CLAVE_SESION_LOCAL = 'toqui.sesion.local';

/** Deja una sesión local guardada, como si la educadora ya hubiera ingresado. */
export function conSesion() {
  localStorage.setItem(CLAVE_SESION_LOCAL, EDUCADORA.email);
}

export const servidor = setupServer(
  getGetMeMockHandler(EDUCADORA),
  getListarNinosMockHandler(NINOS),
  getListarNivelesMockHandler(NIVELES),
  getListarManifestacionesMockHandler(MANIFESTACIONES),
  getObtenerTrayectoriaMockHandler(({ params }) => trayectoria(String(params['id']))),
  ...handlersCapturas,
);

export function conProveedores(contenido: ReactNode) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // StrictMode como en `main.tsx`: detecta efectos que no toleran ejecutarse dos veces.
  return render(
    <StrictMode>
      <QueryClientProvider client={cliente}>
        <ThemeProvider theme={tema}>{contenido}</ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

/** Deja en la API falsa una nota ya confirmada, creada hace `dias` días. */
export function sembrarConfirmada(
  idNino: string,
  texto: string,
  idManifestacion: string,
  dias = 0,
) {
  const nino = NINOS.find((n) => n.id === idNino)!;
  const m = manifestacion(idManifestacion);
  const creada = new Date();
  creada.setDate(creada.getDate() - dias);
  const id = `00000000-0000-4000-9000-${String(CAPTURAS.size + 1).padStart(12, '0')}`;
  CAPTURAS.set(id, {
    id,
    nino: { id: nino.id, nombres: nino.nombres, apellidos: nino.apellidos, sala: nino.sala },
    autor: 'Mercedes Rojas',
    formato: 'texto',
    estado: 'confirmada',
    creadoEn: creada.toISOString(),
    texto,
    tieneArchivo: false,
    errorDetalle: null,
    borrador: null,
    observacion: {
      id: `APP-${id}`,
      fecha: haceDias(dias),
      nivelEstimado: m.nivel,
      manifestaciones: [{ manifestacion: m, cita: null }],
    },
  });
  // Como la API real: la observación confirmada también aparece en la trayectoria.
  OBSERVACIONES[idNino] = [
    {
      id: `APP-${id}`,
      fecha: haceDias(dias),
      formato: 'texto',
      origen: 'app',
      nivelEstimado: m.nivel,
      notaBreve: texto,
      manifestaciones: [m],
    },
    ...(OBSERVACIONES[idNino] ?? []),
  ];
}
