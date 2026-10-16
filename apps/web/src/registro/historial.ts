import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Lo que la app guarda en `history.state`: la vista, su posición y quién la montó. */
interface Entrada<T> {
  clave: string;
  sesion: string;
  n: number;
  vista: T;
}

function esEntrada<T>(estado: unknown, clave: string): estado is Entrada<T> {
  return (estado as Entrada<T> | null)?.clave === clave;
}

function igual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Vista de la app sincronizada con el historial del navegador (diseño D2 de
 * `corregir-interfaz-web`): `ir` agrega una entrada y `volver` la quita, así el botón Atrás del
 * navegador o del celular retrocede dentro de la app en vez de salir de ella. La URL no cambia.
 *
 * - `restaurable`: si Adelante lleva a una vista que no se puede rearmar (una nota a medio hacer),
 *   se retrocede de nuevo.
 * - `interceptar`: se llama antes de retroceder con Atrás; si devuelve true, la app se queda donde
 *   estaba (por ejemplo, para confirmar la salida de una nota en curso) y puede llamar a `volver`.
 * - `activo`: con false no toca el historial (otra vista, como el panel, lo maneja).
 */
export function useVistaConHistorial<T>({
  clave,
  inicial,
  restaurable = () => true,
  interceptar,
  activo = true,
}: {
  clave: string;
  inicial: T;
  restaurable?: (vista: T) => boolean;
  interceptar?: () => boolean;
  activo?: boolean;
}) {
  const [vista, setVista] = useState<T>(inicial);
  /** Vistas de esta sesión de la app, en el orden del historial; la última es la actual. */
  const pila = useRef<T[]>([inicial]);
  /** Retrocesos pedidos por la app: su `popstate` ya se aplicó. */
  const ignorar = useRef(0);
  const sesion = useRef('');
  const opciones = useRef({ inicial, restaurable, interceptar });
  // Las funciones más recientes, para el `popstate` (que se registra una sola vez).
  useLayoutEffect(() => {
    opciones.current = { inicial, restaurable, interceptar };
  });

  const entrada = useCallback(
    (n: number, v: T): Entrada<T> => ({ clave, sesion: sesion.current, n, vista: v }),
    [clave],
  );

  useEffect(() => {
    if (!activo) return;
    sesion.current = Math.random().toString(36).slice(2);
    pila.current = [opciones.current.inicial];
    window.history.replaceState(entrada(0, opciones.current.inicial), '');

    const alCambiar = (e: PopStateEvent) => {
      if (ignorar.current > 0) {
        ignorar.current -= 1;
        return;
      }
      const { inicial, restaurable, interceptar } = opciones.current;
      const actual = pila.current.length - 1;
      const destino =
        esEntrada<T>(e.state, clave) && e.state.sesion === sesion.current ? e.state : null;
      // Entradas de otra carga de la página: se muestran como la vista inicial.
      if (!destino) {
        pila.current = [inicial];
        setVista(inicial);
        return;
      }
      if (destino.n < actual && interceptar?.()) {
        // Se vuelve a poner la entrada actual mientras la app decide.
        window.history.pushState(entrada(actual, pila.current[actual] as T), '');
        return;
      }
      if (destino.n > actual && !restaurable(destino.vista)) {
        ignorar.current += 1;
        window.history.back();
        return;
      }
      pila.current = [...pila.current.slice(0, destino.n), destino.vista];
      setVista(destino.vista);
    };
    window.addEventListener('popstate', alCambiar);
    return () => window.removeEventListener('popstate', alCambiar);
  }, [clave, entrada, activo]);

  /** Abre una vista nueva (no repite la actual) y lleva el scroll al inicio. */
  const ir = useCallback(
    (v: T) => {
      const actual = pila.current.at(-1) as T;
      if (igual(actual, v)) return;
      pila.current = [...pila.current, v];
      window.history.pushState(entrada(pila.current.length - 1, v), '');
      setVista(v);
      window.scrollTo(0, 0);
    },
    [entrada],
  );

  /** Vuelve a la vista anterior de la app; sin anterior, reemplaza la actual por `alternativa`. */
  const volver = useCallback(
    (alternativa?: T) => {
      if (pila.current.length > 1) {
        pila.current = pila.current.slice(0, -1);
        setVista(pila.current.at(-1) as T);
        ignorar.current += 1;
        window.history.back();
        return;
      }
      const v = alternativa ?? opciones.current.inicial;
      pila.current = [v];
      window.history.replaceState(entrada(0, v), '');
      setVista(v);
    },
    [entrada],
  );

  return { vista, ir, volver };
}
