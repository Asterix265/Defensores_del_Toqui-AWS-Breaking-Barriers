import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { aNino, type Manifestacion } from './api';
import { PanelSalas } from './PanelSalas';
import {
  MANIFESTACIONES,
  NINOS,
  NIVELES,
  conProveedores,
  reiniciarApi,
  servidor,
} from './prueba-api';

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  reiniciarApi();
});
afterAll(() => servidor.close());

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });
const catalogo = { niveles: NIVELES, manifestaciones: MANIFESTACIONES as Manifestacion[] };

describe('scroll', () => {
  it('guardar una nota en PC deja la página desplazable', async () => {
    conProveedores(
      <PanelSalas
        ninos={NINOS.map(aNino)}
        salas={['SG-A', 'SG-B']}
        salaPropia="SG-A"
        catalogo={catalogo}
        ahora={new Date()}
        nombre="Claudia"
        onGuardada={() => undefined}
      />,
    );
    fireEvent.click(boton('Nueva nota'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Escribir/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
      target: { value: 'Apiló cinco bloques y aplaudió.' },
    });
    fireEvent.click(boton('Listo'));
    fireEvent.click(boton('Vicente P.'));
    fireEvent.click(boton('Seguir con Vicente P.'));
    await screen.findByRole('heading', { name: '¿Está bien?' });
    fireEvent.click(boton('Está bien'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('');
  });
});
