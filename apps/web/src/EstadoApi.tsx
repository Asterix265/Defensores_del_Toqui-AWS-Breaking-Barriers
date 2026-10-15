import { useGetHealth } from './api/generated/health/health';

/** Pantalla técnica (/estado): confirma que la web se comunica con la API. */
export function EstadoApi() {
  const { data, isPending, isError } = useGetHealth();

  let estado = 'Consultando la API…';
  if (isError) estado = 'No se pudo contactar la API';
  else if (data) {
    const salud = data.data;
    estado = `API ${salud.status === 'ok' ? 'operativa' : 'degradada'} · base de datos ${
      salud.dependencies.database === 'up' ? 'conectada' : 'sin conexión'
    }`;
  }

  return (
    <main>
      <h1>Defensores del Toqui</h1>
      <p>Desafío E-1 · Ruta de Trayectoria de Aprendizaje</p>
      <p role="status" aria-busy={isPending}>
        {estado}
      </p>
    </main>
  );
}
