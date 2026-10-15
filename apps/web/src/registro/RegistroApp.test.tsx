import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { conProveedores, servidor } from './prueba-api';
import { RegistroApp } from './RegistroApp';

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => servidor.resetHandlers());
afterAll(() => servidor.close());

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

async function ingresado() {
  localStorage.setItem('toqui.registro.correo', 'mercedes@integra.cl');
  conProveedores(<RegistroApp />);
  await screen.findByRole('heading', { name: 'Hola, Mercedes' });
}

async function escribirNota(texto: string) {
  fireEvent.click(boton(/Escribir/));
  fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
    target: { value: texto },
  });
  fireEvent.click(boton('Listo'));
}

describe('RegistroApp', () => {
  beforeEach(() => localStorage.clear());

  it('ingresa con correo y código, carga el jardín desde la API y recuerda la sesión', async () => {
    const { unmount } = conProveedores(<RegistroApp />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Correo' }), {
      target: { value: 'mercedes@integra.cl' },
    });
    fireEvent.click(boton('Enviar código'));

    expect(boton('Entrar')).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Número 1 de 6' }), {
      target: { value: '482913' },
    });
    fireEvent.click(boton('Entrar'));

    expect(screen.getByRole('status')).toHaveTextContent('Cargando tu jardín…');
    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();

    unmount();
    conProveedores(<RegistroApp />);
    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
  });

  it('avisa si no puede conectarse con la API', async () => {
    servidor.use(http.get('*/ninos', () => new HttpResponse(null, { status: 500 })));
    localStorage.setItem('toqui.registro.correo', 'mercedes@integra.cl');
    conProveedores(<RegistroApp />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con la API');
  });

  it('propone nivel y manifestación con cita, y la nota confirmada aparece en Mis notas', async () => {
    await ingresado();
    await escribirNota('Apiló tres bloques y aplaudió.');

    expect(screen.getByText('Nota lista')).toBeInTheDocument();
    expect(boton('Elige un niño o niña')).toBeDisabled();
    // Solo la sala propia (la primera, Sala A): Vicente es de la Sala B.
    expect(screen.queryByRole('button', { name: 'Vicente P.' })).not.toBeInTheDocument();
    fireEvent.click(boton('Benjamín S.'));
    fireEvent.click(boton('Seguir con Benjamín S.'));

    // 20 meses → nivel 7; «apiló» y «bloques» → Motor fino.
    expect(screen.getByRole('status', { name: 'Nivel estimado' })).toHaveTextContent('Nivel 7');
    expect(screen.getByText(/estimación pedagógica, no un diagnóstico/)).toBeInTheDocument();
    const propuesta = screen.getByRole('region', { name: 'Prueba MF 7' });
    expect(within(propuesta).getByText('«Apiló tres bloques y aplaudió.»')).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(screen.getByText('Nota guardada para Benjamín S.')).toBeInTheDocument();
    fireEvent.click(boton('Mis notas'));
    const hoy = screen.getByRole('region', { name: 'Hoy' });
    expect(within(hoy).getByText('Apiló tres bloques y aplaudió.')).toBeInTheDocument();
    expect(within(hoy).getByText('Motor fino')).toBeInTheDocument();
  });

  it('sin evidencia suficiente pide elegir manifestaciones del nivel', async () => {
    await ingresado();
    await escribirNota('Hoy llegó temprano al jardín.');
    fireEvent.click(boton('Tomás A.'));
    fireEvent.click(boton('Seguir con Tomás A.'));

    expect(screen.getByText(/No encontramos evidencia suficiente/)).toBeInTheDocument();
    expect(boton('Está bien')).toBeDisabled();
    const catalogo = screen.getByRole('region', { name: 'Catálogo de manifestaciones' });
    expect(within(catalogo).queryByText('Prueba SE 8')).not.toBeInTheDocument();
    fireEvent.click(within(catalogo).getByRole('button', { name: /Prueba SE 7/ }));
    expect(boton('Está bien')).toBeEnabled();

    // Cambiar el nivel quita lo elegido: la API exige manifestaciones del nivel confirmado.
    fireEvent.click(boton('Subir nivel'));
    expect(screen.getByRole('status', { name: 'Nivel estimado' })).toHaveTextContent('Nivel 8');
    expect(boton('Está bien')).toBeDisabled();
    fireEvent.click(within(catalogo).getByRole('button', { name: /Prueba SE 8/ }));
    fireEvent.click(boton('Quitar «Prueba SE 8»'));
    expect(boton('Está bien')).toBeDisabled();

    fireEvent.click(boton('Borrar nota'));
    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    expect(screen.queryByText(/Nota guardada/)).not.toBeInTheDocument();
  });

  it('permite quitar la propuesta y agregar otra del catálogo en una nota de foto', async () => {
    await ingresado();
    fireEvent.click(boton(/Foto/));
    fireEvent.click(boton('Tomar foto'));
    expect(screen.getByText('Foto lista')).toBeInTheDocument();
    fireEvent.click(boton('Tomás A.'));
    fireEvent.click(boton('Seguir con Tomás A.'));

    expect(screen.getByText('Esto leímos en tu post-it')).toBeInTheDocument();
    fireEvent.click(boton(/Quitar «Prueba MF 7»/));
    fireEvent.click(boton('Agregar manifestación'));
    fireEvent.click(boton(/Prueba MG 7/));
    fireEvent.click(boton('Está bien'));

    expect(screen.getByText('Nota guardada para Tomás A.')).toBeInTheDocument();
  });
});
