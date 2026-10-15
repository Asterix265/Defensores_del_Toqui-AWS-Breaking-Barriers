/**
 * Registro de una nota contra la API: crear la captura, subir el archivo a S3, avisar la
 * subida y esperar el borrador. Confirmar y descartar guardan la decisión de la educadora.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  avisarSubida,
  confirmarCaptura,
  crearCaptura,
  descartarCaptura,
  getListarCapturasQueryKey,
  listarCapturas,
  obtenerCaptura,
} from '../api/generated/capturas/capturas';
import type {
  CapturaDetalleDtoOutput,
  CapturaResumenOutput,
  ListarCapturasParams,
} from '../api/generated/model';
import { aNino, type NivelRuta } from './api';
import { tipoBase } from './captura';
import type { Dominio, Formato, ManifestacionCitada, Nino } from './datos';

export type CapturaDetalle = CapturaDetalleDtoOutput;
export type Procesamiento = NonNullable<NonNullable<CapturaDetalle['borrador']>['procesamiento']>;

/** Lo que capturó la educadora: el texto escrito o el archivo de audio o foto. */
export type Entrada =
  { formato: 'texto'; texto: string } | { formato: 'audio' | 'foto'; archivo: Blob };

export type EtapaRegistro = 'creando' | 'subiendo' | 'procesando';

/** Error con un mensaje que se puede mostrar tal cual. */
export class ErrorRegistro extends Error {}

const ESPERA_ENTRE_CONSULTAS_MS = 1000;
const ESPERA_MAXIMA_MS = 30_000;

/** Nivel de la ruta cuyo rango de edad contiene la edad; el último si la supera. */
export function nivelEsperado(edadMeses: number, niveles: NivelRuta[]): number {
  const enRango = niveles.find((n) => edadMeses >= n.edadMinMeses && edadMeses < n.edadMaxMeses);
  return enRango?.nivel ?? niveles.at(-1)?.nivel ?? 1;
}

function mensajeApi(cuerpo: unknown, porDefecto: string): string {
  const mensaje = (cuerpo as { message?: unknown } | null)?.message;
  if (typeof mensaje === 'string') return mensaje;
  if (Array.isArray(mensaje)) return mensaje.join('; ');
  return porDefecto;
}

/**
 * Crea la captura y espera su borrador. Con audio o foto, sube el archivo a S3 con la URL
 * firmada (el tipo y el tamaño van en la firma) y avisa a la API que llegó.
 */
export async function registrarCaptura(
  nino: Nino,
  entrada: Entrada,
  onEtapa: (etapa: EtapaRegistro) => void = () => undefined,
  esperaMs = ESPERA_ENTRE_CONSULTAS_MS,
): Promise<CapturaDetalle> {
  onEtapa('creando');
  const tipo = entrada.formato === 'texto' ? null : tipoBase(entrada.archivo.type);
  const creada = await crearCaptura(
    entrada.formato === 'texto'
      ? { idNino: nino.id, formato: 'texto', texto: entrada.texto }
      : {
          idNino: nino.id,
          formato: entrada.formato,
          archivo: { tipo: tipo as never, tamano: entrada.archivo.size },
        },
  );
  if (creada.status !== 201) {
    throw new ErrorRegistro(mensajeApi(creada.data, 'La API no pudo crear la nota.'));
  }
  const { captura, subida } = creada.data;

  if (subida && entrada.formato !== 'texto') {
    onEtapa('subiendo');
    let respuesta: Response;
    try {
      respuesta = await fetch(subida.url, {
        method: subida.metodo,
        headers: subida.cabeceras,
        body: entrada.archivo,
      });
    } catch {
      throw new ErrorRegistro('No se pudo subir el archivo a S3. Revisa la conexión.');
    }
    if (!respuesta.ok) {
      throw new ErrorRegistro(`S3 rechazó el archivo (${respuesta.status}).`);
    }
    const aviso = await avisarSubida(captura.id);
    if (aviso.status !== 200) {
      throw new ErrorRegistro(mensajeApi(aviso.data, 'La API no recibió el aviso de subida.'));
    }
  }

  onEtapa('procesando');
  const limite = Date.now() + ESPERA_MAXIMA_MS;
  for (;;) {
    const actual = await obtenerCaptura(captura.id);
    if (actual.status !== 200) throw new ErrorRegistro('No se pudo consultar la nota.');
    if (actual.data.estado !== 'procesando') return actual.data;
    if (Date.now() > limite) {
      throw new ErrorRegistro('El procesamiento está tardando demasiado. Intenta de nuevo.');
    }
    await new Promise((r) => setTimeout(r, esperaMs));
  }
}

/** Invalida lo que cambia al decidir sobre una nota: las listas y los registros del niño o niña. */
function useAlDecidir() {
  const cliente = useQueryClient();
  return (idNino: string) =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: ['/api/capturas'] }),
      cliente.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith(`/api/ninos/${idNino}/`),
      }),
    ]);
}

export function useConfirmar() {
  const alDecidir = useAlDecidir();
  return useMutation({
    mutationFn: async (v: {
      captura: CapturaDetalle;
      nivel: number;
      manifestaciones: ManifestacionCitada[];
    }) => {
      const res = await confirmarCaptura(v.captura.id, {
        nivel: v.nivel,
        manifestaciones: v.manifestaciones.map((m) => ({
          idManifestacion: m.manifestacion.id,
          ...(m.cita && { cita: m.cita }),
        })),
      });
      if (res.status !== 200) {
        throw new ErrorRegistro(mensajeApi(res.data, 'No se pudo guardar la nota.'));
      }
      return res.data;
    },
    onSuccess: (_, v) => alDecidir(v.captura.nino.id),
  });
}

export function useDescartar() {
  const alDecidir = useAlDecidir();
  return useMutation({
    mutationFn: async (captura: CapturaDetalle) => {
      const res = await descartarCaptura(captura.id);
      if (res.status !== 200) {
        throw new ErrorRegistro(mensajeApi(res.data, 'No se pudo descartar la nota.'));
      }
      return res.data;
    },
    onSuccess: (_, captura) => alDecidir(captura.nino.id),
  });
}

/** Nota guardada en la API, lista para mostrar. */
export interface NotaGuardada {
  id: string;
  nino: Nino;
  autor: string;
  formato: Formato;
  estado: CapturaResumenOutput['estado'];
  creada: Date;
  texto: string | null;
  dominios: Dominio[];
  nivel: number | null;
}

function aNota(c: CapturaResumenOutput, ninos: Nino[]): NotaGuardada {
  const nino =
    ninos.find((n) => n.id === c.nino.id) ??
    aNino({ ...c.nino, fechaNacimiento: '2000-01-01', edadMeses: 0 });
  return {
    id: c.id,
    nino,
    autor: c.autor,
    formato: c.formato,
    estado: c.estado,
    creada: new Date(c.creadoEn),
    texto: c.extracto,
    dominios: c.dominios as Dominio[],
    nivel: c.nivel,
  };
}

/** Hasta 100 notas del jardín (la API pagina; la demo no necesita más). */
export function useNotas(ninos: Nino[], filtro: Omit<ListarCapturasParams, 'pagina' | 'tamano'>) {
  const params: ListarCapturasParams = { ...filtro, tamano: 100 };
  return useQuery({
    queryKey: getListarCapturasQueryKey(params),
    queryFn: async ({ signal }) => {
      const res = await listarCapturas(params, { signal });
      if (res.status !== 200) throw new Error(`La API respondió ${res.status}`);
      return res.data.items;
    },
    select: (items) => items.map((c) => aNota(c, ninos)),
  });
}
