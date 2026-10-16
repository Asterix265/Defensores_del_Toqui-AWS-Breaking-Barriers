import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { conProveedores, conSesion, instalarMicrofono, reiniciarApi, servidor } from './prueba-api';
import { RegistroApp } from './RegistroApp';

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  reiniciarApi();
});
afterAll(() => servidor.close());

async function abrirMiSala() {
  conSesion();
  conProveedores(<RegistroApp />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mi sala' }));
}

async function abrirFicha(nombre: string) {
  await abrirMiSala();
  fireEvent.click(boton(new RegExp(nombre)));
  await screen.findByRole('heading', { name: nombre });
  // Espera los registros de la API.
  await screen.findAllByRole('region');
}

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });
const area = (nombre: string) => screen.getByRole('region', { name: nombre });

describe('Mi sala', () => {
  beforeEach(() => localStorage.clear());

  it('lista solo la sala propia e indica las áreas sin registros', async () => {
    await abrirMiSala();
    expect(screen.getByRole('heading', { name: 'Mi sala' })).toBeInTheDocument();
    expect(await screen.findByText('1 área sin notas')).toBeInTheDocument();
    expect(boton(/Martina/)).toHaveTextContent('1 área sin notas');
    expect(boton(/Tomás/)).toHaveTextContent('5 áreas sin notas');
    expect(screen.queryByRole('button', { name: /Vicente/ })).not.toBeInTheDocument();
  });

  it('abre la ficha con las áreas sin registros primero y sin niveles', async () => {
    await abrirFicha('Martina P.');

    expect(boton('Mi sala')).toHaveAttribute('aria-current', 'page');
    const regiones = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regiones[0]).toBe('Motor grueso');
    expect(within(area('Motor grueso')).getByText('0')).toBeInTheDocument();
    expect(within(area('Lenguaje')).getByText('1')).toBeInTheDocument();
    expect(within(area('Lenguaje')).getByText('Última: ayer')).toBeInTheDocument();
    expect(screen.queryByText(/nivel|rezago/i)).not.toBeInTheDocument();
  });

  it('muestra los 3 últimos registros de la API y permite ver todos', async () => {
    await abrirFicha('Martina P.');
    const registros = screen.getAllByRole('article');
    expect(registros).toHaveLength(3);
    expect(registros[0]).toHaveTextContent('Prueba LC 7');
    expect(registros[0]).toHaveTextContent('Registro durante el juego libre.');
    expect(registros[0]).toHaveTextContent('Registro del jardín');
    fireEvent.click(boton('Ver las 4'));
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('invita a registrar la primera nota de un niño o niña sin registros', async () => {
    await abrirMiSala();
    fireEvent.click(boton(/Tomás/));
    expect(await screen.findByText(/Aún no hay notas de Tomás A\./)).toBeInTheDocument();
    expect(screen.getAllByText('Sin notas aún. Buen momento para observar.')).toHaveLength(5);
  });
});

describe('Grabar con y sin niño o niña', () => {
  beforeEach(() => {
    localStorage.clear();
    instalarMicrofono();
  });

  async function grabarYRevisar() {
    fireEvent.click(await screen.findByRole('button', { name: 'Terminar grabación' }));
  }

  it('desde la ficha la nota queda para ese niño o niña sin elegirlo y vuelve a su ficha', async () => {
    await abrirFicha('Martina P.');
    fireEvent.click(boton('Grabar nota de Martina P.'));
    await grabarYRevisar();

    expect(screen.queryByText('¿De quién es?')).not.toBeInTheDocument();
    expect(await screen.findByText('Esto entendimos de tu audio')).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(await screen.findByText('Nota guardada para Martina P.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Martina P.' })).toBeInTheDocument();
    // La observación confirmada vuelve por la trayectoria de la API.
    await screen.findByText(/Registrada en la app/);
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Prueba LC 7');
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Registrada en la app');
  });

  it('al cancelar desde la ficha vuelve a ella sin guardar', async () => {
    await abrirFicha('Martina P.');
    fireEvent.click(boton('Grabar nota de Martina P.'));
    fireEvent.click(boton('Cancelar'));

    expect(screen.getByRole('heading', { name: 'Martina P.' })).toBeInTheDocument();
    expect(screen.queryByText(/Nota guardada/)).not.toBeInTheDocument();
  });

  it('Grabar de la barra con una ficha abierta pide elegir sin nadie preseleccionado', async () => {
    await abrirFicha('Martina P.');
    fireEvent.click(boton('Grabar'));
    await grabarYRevisar();

    expect(await screen.findByText('¿De quién es?')).toBeInTheDocument();
    expect(boton('Elige un niño o niña')).toBeDisabled();
    fireEvent.click(boton('Tomás A.'));
    fireEvent.click(boton('Seguir con Tomás A.'));
    fireEvent.click(await screen.findByRole('button', { name: 'Está bien' }));

    expect(await screen.findByText('Nota guardada para Tomás A.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
  });
});

describe('Cambiar de sala', () => {
  beforeEach(() => {
    localStorage.clear();
    instalarMicrofono();
  });

  function elegirSala(sala: string) {
    fireEvent.click(boton(/Cambiar sala/));
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(sala) }));
  }

  it('muestra las salas del jardín y marca la propia', async () => {
    await abrirMiSala();
    expect(boton(/Cambiar sala/)).toHaveTextContent('Sala A');
    fireEvent.click(boton(/Cambiar sala/));

    const opciones = screen.getAllByRole('menuitem');
    expect(opciones).toHaveLength(2);
    expect(opciones[0]).toHaveTextContent(/Sala A.*Tu sala · 3 niños y niñas/);
    expect(opciones[1]).not.toHaveTextContent('Tu sala');
  });

  it('lista los niños y niñas de la sala elegida y la mantiene al volver de una ficha', async () => {
    await abrirMiSala();
    elegirSala('Sala B');

    expect(boton(/Cambiar sala/)).toHaveTextContent('Sala B');
    expect(screen.queryByRole('button', { name: /Martina/ })).not.toBeInTheDocument();
    fireEvent.click(boton(/Vicente/));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a Mi sala' }));

    expect(boton(/Cambiar sala/)).toHaveTextContent('Sala B');
    expect(boton(/Vicente/)).toBeInTheDocument();
  });

  it('graba desde la ficha de otra sala; Grabar de la barra sigue ofreciendo la propia', async () => {
    await abrirMiSala();
    elegirSala('Sala B');
    fireEvent.click(boton(/Vicente/));
    fireEvent.click(await screen.findByRole('button', { name: 'Grabar nota de Vicente P.' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Terminar grabación' }));
    // 31 meses → nivel 9.
    expect(await screen.findByRole('status', { name: 'Nivel estimado' })).toHaveTextContent(
      'Nivel 9',
    );
    fireEvent.click(boton('Está bien'));
    expect(await screen.findByText('Nota guardada para Vicente P.')).toBeInTheDocument();

    fireEvent.click(boton('Grabar'));
    fireEvent.click(await screen.findByRole('button', { name: 'Terminar grabación' }));
    expect(await screen.findByRole('button', { name: 'Martina P.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vicente P.' })).not.toBeInTheDocument();
  });
});
