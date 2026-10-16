import type { Manifestacion, MensajeCaptura } from '@toqui/shared';
import { vi } from 'vitest';
import { ContextoVacio } from '../adaptadores/nulos.js';
import { ClasificadorFake } from '../ia/fake.js';
import type { Dependencias } from '../puertos.js';

/** Datos sintéticos para pruebas: ningún id ni texto corresponde a una persona real. */
export const ID_CAPTURA = '7d3f1b6e-2c4a-4e8b-9f10-1a2b3c4d5e6f';

export const CATALOGO: Manifestacion[] = [
  { id: 'M-4-MF-1', nivel: 4, dominio: 'motor_fino', textoObservable: 'Apila 3 o más bloques' },
  { id: 'M-4-LC-1', nivel: 4, dominio: 'lenguaje_comunicacion', textoObservable: 'Dice palabras' },
  { id: 'M-5-MF-1', nivel: 5, dominio: 'motor_fino', textoObservable: 'Encaja piezas' },
];

const BASE = {
  version: 1 as const,
  idCaptura: ID_CAPTURA,
  idUsuario: 'sub-educadora-1',
  idJardin: 'J-001',
  edadMeses: 20,
  nivelEsperado: 4,
  catalogo: CATALOGO,
};

export function mensajeTexto(texto = 'Apiló cinco bloques sin ayuda y sonrió.'): MensajeCaptura {
  return { ...BASE, formato: 'texto', texto };
}

export function mensajeArchivo(
  formato: 'audio' | 'foto',
  archivoClave: string,
  archivoTipo: string,
): MensajeCaptura {
  return { ...BASE, formato, archivoClave, archivoTipo } as MensajeCaptura;
}

export function depsFalsas(cambios: Partial<Dependencias> = {}): Dependencias {
  return {
    transcriptor: { transcribir: vi.fn(async () => 'Dijo agua cuando tuvo sed.') },
    lectorImagen: { proveedor: 'prueba', leer: vi.fn(async () => 'Apiló cuatro bloques solo.') },
    anonimizador: { anonimizar: vi.fn(async (t: string) => t) },
    contexto: new ContextoVacio(),
    clasificador: new ClasificadorFake(),
    api: {
      entregarBorrador: vi.fn(async () => 'borrador_listo' as const),
      informarError: vi.fn(async () => 'error' as const),
    },
    avisador: { avisar: vi.fn(async () => undefined) },
    ...cambios,
  };
}
