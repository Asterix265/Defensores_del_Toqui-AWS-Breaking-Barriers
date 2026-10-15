import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { RegistroApp } from './RegistroApp';
import { tema } from './tema';

function abrirMiSala() {
  localStorage.setItem('toqui.registro.correo', 'mercedes@integra.cl');
  render(
    <ThemeProvider theme={tema}>
      <RegistroApp />
    </ThemeProvider>,
  );
  fireEvent.click(boton('Mi sala'));
}

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });
const area = (nombre: string) => screen.getByRole('region', { name: nombre });

describe('Mi sala', () => {
  beforeEach(() => localStorage.clear());

  it('lista solo la sala propia e indica las áreas sin notas', () => {
    abrirMiSala();
    expect(screen.getByRole('heading', { name: 'Mi sala' })).toBeInTheDocument();
    expect(boton(/Martina/)).toHaveTextContent('1 área sin notas');
    expect(boton(/Mateo/)).toHaveTextContent('5 áreas sin notas');
    expect(screen.queryByRole('button', { name: /Vicente/ })).not.toBeInTheDocument();
  });

  it('abre la ficha con las áreas sin notas primero y sin niveles', () => {
    abrirMiSala();
    fireEvent.click(boton(/Martina/));

    expect(screen.getByRole('heading', { name: 'Martina' })).toBeInTheDocument();
    expect(boton('Mi sala')).toHaveAttribute('aria-current', 'page');
    const regiones = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regiones[0]).toBe('Motor grueso');
    expect(within(area('Motor grueso')).getByText('0')).toBeInTheDocument();
    expect(within(area('Lenguaje')).getByText('1')).toBeInTheDocument();
    expect(within(area('Lenguaje')).getByText('Última: ayer')).toBeInTheDocument();
    expect(screen.queryByText(/nivel|rezago/i)).not.toBeInTheDocument();
  });

  it('muestra las 3 últimas notas y permite ver todas', () => {
    abrirMiSala();
    fireEvent.click(boton(/Martina/));
    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.click(boton('Ver las 4'));
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('invita a registrar la primera nota de un niño o niña sin notas', () => {
    abrirMiSala();
    fireEvent.click(boton(/Mateo/));
    expect(screen.getByText(/Aún no hay notas de Mateo/)).toBeInTheDocument();
    expect(screen.getAllByText('Sin notas aún. Buen momento para observar.')).toHaveLength(5);
  });
});

describe('Grabar con y sin niño o niña', () => {
  beforeEach(() => localStorage.clear());

  it('desde la ficha la nota queda para ese niño o niña sin elegirlo y vuelve a su ficha', () => {
    abrirMiSala();
    fireEvent.click(boton(/Martina/));
    fireEvent.click(boton('Grabar nota de Martina'));
    fireEvent.click(boton('Terminar grabación'));

    expect(screen.queryByText('¿De quién es?')).not.toBeInTheDocument();
    expect(screen.getByText('Esto entendimos de tu audio')).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(screen.getByText('Nota guardada para Martina')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Martina' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')[0]).toHaveTextContent(/Buscó el autito/);
  });

  it('al cancelar desde la ficha vuelve a ella sin guardar', () => {
    abrirMiSala();
    fireEvent.click(boton(/Martina/));
    fireEvent.click(boton('Grabar nota de Martina'));
    fireEvent.click(boton('Cancelar'));

    expect(screen.getByRole('heading', { name: 'Martina' })).toBeInTheDocument();
    expect(screen.queryByText('Nota guardada para Martina')).not.toBeInTheDocument();
  });

  it('Grabar de la barra con una ficha abierta pide elegir sin nadie preseleccionado', () => {
    abrirMiSala();
    fireEvent.click(boton(/Martina/));
    fireEvent.click(boton('Grabar'));
    fireEvent.click(boton('Terminar grabación'));

    expect(screen.getByText('¿De quién es?')).toBeInTheDocument();
    expect(boton('Elige un niño o niña')).toBeDisabled();
    fireEvent.click(boton('Tomás'));
    fireEvent.click(boton('Seguir con Tomás'));
    fireEvent.click(boton('Está bien'));

    expect(screen.getByText('Nota guardada para Tomás')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
  });
});
