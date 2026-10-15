import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { RegistroApp } from './RegistroApp';
import { tema } from './tema';

function renderizar() {
  return render(
    <ThemeProvider theme={tema}>
      <RegistroApp />
    </ThemeProvider>,
  );
}

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

describe('RegistroApp', () => {
  beforeEach(() => localStorage.clear());

  it('ingresa con correo y código y recuerda la sesión', () => {
    const { unmount } = renderizar();

    fireEvent.change(screen.getByRole('textbox', { name: 'Correo' }), {
      target: { value: 'mercedes@integra.cl' },
    });
    fireEvent.click(boton('Enviar código'));

    expect(boton('Entrar')).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Número 1 de 6' }), {
      target: { value: '482913' },
    });
    fireEvent.click(boton('Entrar'));

    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();

    unmount();
    renderizar();
    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
  });

  it('guarda una nota escrita con el área sugerida y la muestra en Mis notas', () => {
    localStorage.setItem('toqui.registro.correo', 'mercedes@integra.cl');
    renderizar();

    fireEvent.click(boton(/Escribir/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
      target: { value: 'Apiló tres bloques y aplaudió.' },
    });
    fireEvent.click(boton('Listo'));

    expect(screen.getByText('Nota lista')).toBeInTheDocument();
    expect(boton('Elige un niño o niña')).toBeDisabled();
    fireEvent.click(boton('Benjamín'));
    fireEvent.click(boton('Seguir con Benjamín'));

    expect(screen.getByText('Área sugerida')).toBeInTheDocument();
    expect(screen.getByText('Motor fino')).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(screen.getByText('Nota guardada para Benjamín')).toBeInTheDocument();
    fireEvent.click(boton('Mis notas'));
    const hoy = screen.getByRole('region', { name: 'Hoy' });
    expect(within(hoy).getByText('Apiló tres bloques y aplaudió.')).toBeInTheDocument();
  });

  it('permite cambiar el área y borrar una nota de foto sin guardarla', () => {
    localStorage.setItem('toqui.registro.correo', 'mercedes@integra.cl');
    renderizar();

    fireEvent.click(boton(/Foto/));
    fireEvent.click(boton('Tomar foto'));
    expect(screen.getByText('Foto lista')).toBeInTheDocument();
    fireEvent.click(boton('Tomás'));
    fireEvent.click(boton('Seguir con Tomás'));

    expect(screen.getByText('Esto leímos en tu post-it')).toBeInTheDocument();
    fireEvent.click(boton('Cambiar'));
    fireEvent.click(boton('Cognitivo'));
    expect(screen.queryByRole('button', { name: 'Lenguaje' })).not.toBeInTheDocument();

    fireEvent.click(boton('Borrar nota'));
    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    expect(screen.queryByText('Nota guardada para Tomás')).not.toBeInTheDocument();
  });
});
