import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { Ingreso, MENSAJE_ERROR } from './Ingreso';
import { tema } from './tema';

function mostrar(onIngresar = vi.fn().mockResolvedValue(null)) {
  render(
    <ThemeProvider theme={tema}>
      <Ingreso onIngresar={onIngresar} />
    </ThemeProvider>,
  );
  return onIngresar;
}

function completar(correo: string, clave: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Correo' }), { target: { value: correo } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: clave } });
}

const entrar = () => screen.getByRole('button', { name: 'Entrar' });

describe('Ingreso', () => {
  it('pide un correo válido y una contraseña antes de habilitar Entrar', () => {
    mostrar();
    expect(entrar()).toBeDisabled();
    completar('no-es-correo', 'clave');
    expect(entrar()).toBeDisabled();
    completar('educadora@example.com', '');
    expect(entrar()).toBeDisabled();
    completar('educadora@example.com', 'clave');
    expect(entrar()).toBeEnabled();
  });

  it('envía el correo sin espacios y la contraseña tal cual', async () => {
    const onIngresar = mostrar();
    completar('  educadora@example.com ', ' clave con espacios ');
    fireEvent.click(entrar());
    expect(onIngresar).toHaveBeenCalledWith('educadora@example.com', ' clave con espacios ');
    expect(await screen.findByRole('button', { name: 'Ingresando…' })).toBeDisabled();
  });

  it('muestra el error, borra la contraseña y conserva el correo', async () => {
    mostrar(vi.fn().mockResolvedValue('credenciales'));
    completar('educadora@example.com', 'mala');
    fireEvent.click(entrar());

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAJE_ERROR.credenciales);
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Correo' })).toHaveValue('educadora@example.com');
  });

  it('permite mostrar la contraseña y usa autocompletado de gestores de contraseñas', () => {
    mostrar();
    const clave = screen.getByLabelText('Contraseña');
    expect(clave).toHaveAttribute('type', 'password');
    expect(clave).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('textbox', { name: 'Correo' })).toHaveAttribute(
      'autocomplete',
      'username',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(clave).toHaveAttribute('type', 'text');
  });
});
