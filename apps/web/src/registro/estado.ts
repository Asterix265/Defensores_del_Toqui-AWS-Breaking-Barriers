/**
 * Estado de las salas, vista general del jardín y cuentas (panel-directora-y-aprendizaje).
 * Las alertas son reglas de demostración de la metodología del dataset: piden revisar en
 * contexto, no son un diagnóstico.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activarCuenta,
  desactivarCuenta,
  getListarCuentasQueryKey,
  invitarCuenta,
  listarCuentas,
  reenviarInvitacion,
} from '../api/generated/cuentas/cuentas';
import type {
  AlertaIndividualOutput,
  CuentaOutput,
  EstadoSalaResponseDtoOutput,
  InvitarCuentaRequestDto,
  ResumenJardinResponseDtoOutput,
  ResumenNucleoOutput,
  ResumenSalaOutput,
} from '../api/generated/model';
import {
  getObtenerEstadoSalaQueryKey,
  getObtenerResumenJardinQueryKey,
  obtenerEstadoSala,
  obtenerResumenJardin,
} from '../api/generated/salas/salas';
import { datos, ErrorApi, etiquetaSala } from './api';
import { ETIQUETA_NUCLEO, NUCLEOS, type Nino, type Nucleo } from './datos';
import { ErrorRegistro, mensajeApi } from './registrar';

export type EstadoSala = EstadoSalaResponseDtoOutput;
export type ResumenJardin = ResumenJardinResponseDtoOutput;
export type ResumenSala = ResumenSalaOutput;
export type ResumenNucleo = ResumenNucleoOutput;
export type Alerta = AlertaIndividualOutput;
export type Cuenta = CuentaOutput;

export function useEstadoSala(sala: string | null) {
  const params = { sala: sala ?? '' };
  return useQuery({
    queryKey: getObtenerEstadoSalaQueryKey(params),
    queryFn: ({ signal }) => datos(obtenerEstadoSala(params, { signal })),
    enabled: sala !== null && sala !== '',
    staleTime: 60_000,
  });
}

export function useResumenJardin(activo = true) {
  return useQuery({
    queryKey: getObtenerResumenJardinQueryKey(),
    queryFn: ({ signal }) => datos(obtenerResumenJardin(undefined, { signal })),
    enabled: activo,
    staleTime: 60_000,
  });
}

/** Alertas de cada niño o niña de la sala, por id. */
export function alertasPorNino(estado: EstadoSala | undefined): Map<string, Alerta[]> {
  const mapa = new Map<string, Alerta[]>();
  for (const a of estado?.alertas ?? []) mapa.set(a.idNino, [...(mapa.get(a.idNino) ?? []), a]);
  return mapa;
}

/** «4,5»: las medianas pueden quedar entre dos niveles. */
export function formatoNivel(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace('.', ',');
}

export function porcentaje(valor: number): string {
  return `${Math.round(valor * 100)}%`;
}

export const etiquetaNucleo = (n: string) => ETIQUETA_NUCLEO[n as Nucleo] ?? n;

/** Una fila por niño o niña y núcleo: nivel vigente, fecha de corte y alerta. */
export function estadoSalaACsv(
  estado: EstadoSala,
  ninos: Nino[],
): { columnas: string[]; filas: string[][] } {
  const alertas = alertasPorNino(estado);
  const deLaSala = ninos.filter((n) => n.sala === estado.sala);
  const filas = deLaSala.flatMap((nino) =>
    NUCLEOS.map((nucleo) => {
      const vigente = estado.niveles.find((v) => v.idNino === nino.id && v.nucleo === nucleo);
      const alerta = alertas.get(nino.id)?.find((a) => a.nucleo === nucleo);
      return [
        etiquetaSala(estado.sala),
        nino.id,
        nino.nombreCompleto,
        String(nino.edadMeses),
        etiquetaNucleo(nucleo),
        vigente ? String(vigente.nivel) : '',
        vigente?.fechaCorte ?? '',
        alerta ? 'para revisar en contexto' : '',
        alerta ? formatoNivel(alerta.referencia) : '',
        alerta ? formatoNivel(alerta.brecha) : '',
      ];
    }),
  );
  return {
    columnas: [
      'sala',
      'id_nino',
      'nino',
      'edad_meses',
      'area',
      'nivel_validado_vigente',
      'fecha_corte',
      'alerta',
      'mediana_pares',
      'brecha',
    ],
    filas,
  };
}

/** Una fila por sala y núcleo del jardín. */
export function resumenJardinACsv(resumen: ResumenJardin): {
  columnas: string[];
  filas: string[][];
} {
  const filas = resumen.salas.flatMap((s) =>
    s.nucleos.map((n) => {
      const alertaSala = s.alertasSala.find((a) => a.nucleo === n.nucleo);
      return [
        resumen.corte,
        etiquetaSala(s.sala),
        String(s.matriculados),
        formatoNivel(s.edadPromedioMeses),
        etiquetaNucleo(n.nucleo),
        String(n.conDecision),
        String(n.sinDecision),
        formatoNivel(n.mediana),
        n.modas.join(' | '),
        String(s.alertasIndividuales),
        alertaSala ? formatoNivel(alertaSala.brecha) : '',
        String(s.observaciones30Dias),
      ];
    }),
  );
  return {
    columnas: [
      'fecha_corte',
      'sala',
      'matriculados',
      'edad_promedio_meses',
      'area',
      'con_decision',
      'sin_decision',
      'mediana',
      'niveles_modales',
      'alertas_individuales_sala',
      'brecha_sala',
      'observaciones_30_dias',
    ],
    filas,
  };
}

// ---- Cuentas ----

export function useCuentas(activo = true) {
  return useQuery({
    queryKey: getListarCuentasQueryKey(),
    queryFn: async ({ signal }) => (await datos(listarCuentas({ signal }))).cuentas,
    enabled: activo,
    // Una respuesta de la API (501 en modo local, 403) no cambia al reintentar; la red sí.
    retry: (intentos, error) => !(error instanceof ErrorApi) && intentos < 2,
  });
}

function useAccion<V>(fn: (v: V) => Promise<{ status: number; data: unknown }>, error: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const res = await fn(v);
      if (res.status < 200 || res.status >= 300) {
        throw new ErrorRegistro(
          res.status === 409 ? 'Ese correo ya tiene cuenta' : mensajeApi(res.data, error),
        );
      }
      return res.data;
    },
    onSuccess: () => cliente.invalidateQueries({ queryKey: getListarCuentasQueryKey() }),
  });
}

/** Acciones de la directora sobre las cuentas; los errores llegan con el mensaje de la API. */
export function useAccionesCuentas() {
  return {
    invitar: useAccion((v: InvitarCuentaRequestDto) => invitarCuenta(v), 'No se pudo invitar.'),
    reenviar: useAccion((u: string) => reenviarInvitacion(u), 'No se pudo reenviar.'),
    desactivar: useAccion((u: string) => desactivarCuenta(u), 'No se pudo desactivar.'),
    activar: useAccion((u: string) => activarCuenta(u), 'No se pudo reactivar.'),
  };
}
