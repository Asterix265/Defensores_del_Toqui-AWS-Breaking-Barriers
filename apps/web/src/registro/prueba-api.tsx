/**
 * Fixtures sintéticos y servidor MSW para las pruebas de «Registro Simple».
 * Los nombres e IDs son inventados para las pruebas; no salen del dataset.
 */
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { setupServer } from 'msw/node';
import {
  getListarManifestacionesMockHandler,
  getListarNivelesMockHandler,
} from '../api/generated/catalogo/catalogo.msw';
import {
  getListarNinosMockHandler,
  getObtenerTrayectoriaMockHandler,
} from '../api/generated/ninos/ninos.msw';
import type {
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
export const OBSERVACIONES: Record<string, ObservacionTrayectoriaOutput[]> = {
  'NINO-T001': [
    observacion('OBS-T1', 1, 'MAN-L07-LC-01', 'Registro durante el juego libre.'),
    observacion('OBS-T2', 3, 'MAN-L07-SE-01'),
    observacion('OBS-T3', 6, 'MAN-L07-CO-01'),
    observacion('OBS-T4', 12, 'MAN-L07-MF-01'),
  ],
};

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

export const servidor = setupServer(
  getListarNinosMockHandler(NINOS),
  getListarNivelesMockHandler(NIVELES),
  getListarManifestacionesMockHandler(MANIFESTACIONES),
  getObtenerTrayectoriaMockHandler(({ params }) => trayectoria(String(params['id']))),
);

export function conProveedores(contenido: ReactNode) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <ThemeProvider theme={tema}>{contenido}</ThemeProvider>
    </QueryClientProvider>,
  );
}
