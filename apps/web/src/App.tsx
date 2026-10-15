import { EstadoApi } from './EstadoApi';
import { RegistroApp } from './registro/RegistroApp';

/** «Registro Simple» para la tía; /estado conserva el chequeo técnico de la API. */
export function App() {
  if (window.location.pathname === '/estado') return <EstadoApi />;
  return <RegistroApp />;
}
