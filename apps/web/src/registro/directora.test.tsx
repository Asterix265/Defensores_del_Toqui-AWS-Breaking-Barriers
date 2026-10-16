import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { aNino, type Manifestacion } from './api';
import { Ingreso } from './Ingreso';
import { PanelSalas } from './PanelSalas';
import {
  MANIFESTACIONES,
  NINOS,
  NIVELES,
  conProveedores,
  reiniciarApi,
  servidor,
} from './prueba-api';
import { tema } from './tema';

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  reiniciarApi();
});
afterAll(() => servidor.close());

const catalogo = { niveles: NIVELES, manifestaciones: MANIFESTACIONES as Manifestacion[] };

function panel(grupo: 'educadora' | 'directora') {
  return conProveedores(
    <PanelSalas
      ninos={NINOS.map(aNino)}
      salas={['SG-A', 'SG-B']}
      // Como en RegistroApp: la directora no tiene sala propia.
      salaPropia={grupo === 'directora' ? '' : 'SG-A'}
      catalogo={catalogo}
      ahora={new Date()}
      nombre="Dora"
      grupo={grupo}
      idUsuario="sub-dora"
      onGuardada={() => undefined}
    />,
  );
}

describe('estado de la sala', () => {
  it('Mi sala muestra el estado por área y resalta a quien queda para revisar', async () => {
    panel('educadora');
    fireEvent.click(screen.getByRole('tab', { name: 'Mi sala' }));

    const estado = await screen.findByRole('region', { name: 'Estado de Sala A' });
    expect(within(estado).getByText('Para revisar en contexto · 1')).toBeInTheDocument();
    expect(within(estado).getByRole('button', { name: 'Revisar a Tomás A.' })).toHaveTextContent(
      'Movimiento: nivel 3 · sala 5',
    );
    expect(within(estado).getByText(/no un diagnóstico/)).toBeInTheDocument();
    expect(await screen.findByText('Revisar 1 área')).toBeInTheDocument();
  });

  it('la educadora no ve las pestañas de la directora', () => {
    panel('educadora');
    expect(screen.queryByRole('tab', { name: 'Jardín' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Equipo' })).toBeNull();
  });
});

describe('vista de la directora', () => {
  it('entra al jardín con todas las salas y abre una sala', async () => {
    panel('directora');
    expect(screen.getByRole('tab', { name: 'Jardín' })).toHaveAttribute('aria-selected', 'true');

    const salas = await screen.findByRole('list', { name: 'Salas del jardín' });
    expect(within(salas).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Niños y niñas para revisar').nextSibling).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: 'Nueva nota' })).toBeNull();

    fireEvent.click(within(salas).getByRole('button', { name: 'Ver Sala B' }));
    expect(await screen.findByRole('region', { name: 'Estado de Sala B' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva nota' })).toBeNull();
  });

  it('en Salas no tiene «tu sala» y elige la sala para ver su estado', async () => {
    panel('directora');
    fireEvent.click(screen.getByRole('tab', { name: 'Salas' }));

    expect(screen.getByRole('heading', { name: 'Salas' })).toBeInTheDocument();
    expect(screen.getByText('Elige una sala para ver su estado por área.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Estado de/ })).toBeNull();
    expect(screen.queryByText(/tu sala/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Sala A/ }));
    expect(await screen.findByRole('region', { name: 'Estado de Sala A' })).toBeInTheDocument();
    expect(screen.getByText(/^Estado por área · Sala A$/i)).toBeInTheDocument();
  });

  it('descarga el CSV del jardín', async () => {
    const crear = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
    panel('directora');
    fireEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));

    const blob = crear.mock.calls[0]![0] as Blob;
    const texto = await blob.text();
    expect(texto.split('\r\n')[0]).toContain('fecha_corte;sala;matriculados');
    expect(texto).toContain('Sala A;3;');
    expect(clic).toHaveBeenCalled();
    [crear, revocar, clic].forEach((s) => s.mockRestore());
  });
});

describe('primer ingreso', () => {
  it('pide la contraseña nueva, valida la política y entra', async () => {
    const onNuevaClave = vi.fn().mockResolvedValue(null);
    render(
      <ThemeProvider theme={tema}>
        <Ingreso
          onIngresar={vi.fn().mockResolvedValue('nueva_clave')}
          onNuevaClave={onNuevaClave}
        />
      </ThemeProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Correo' }), {
      target: { value: 'nueva.tia@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Temporal1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument();
    const guardar = screen.getByRole('button', { name: 'Guardar y entrar' });
    fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'corta' } });
    expect(screen.getByRole('status')).toHaveTextContent('Al menos 12 caracteres.');
    expect(guardar).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
      target: { value: 'JardinSeguro2026' },
    });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
      target: { value: 'JardinSeguro2026' },
    });
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);
    expect(onNuevaClave).toHaveBeenCalledWith('JardinSeguro2026');
  });
});
