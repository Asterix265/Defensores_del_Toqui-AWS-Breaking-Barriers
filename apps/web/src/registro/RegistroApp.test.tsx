import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import {
  capturasCreadas,
  EJEMPLO_AUDIO,
  EJEMPLO_FOTO,
  conProveedores,
  instalarMicrofono,
  reiniciarApi,
  servidor,
} from './prueba-api';
import { RegistroApp } from './RegistroApp';

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  reiniciarApi();
});
afterAll(() => servidor.close());

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

async function ingresado() {
  localStorage.setItem('toqui.registro.correo', 'mercedes@integra.cl');
  const vista = conProveedores(<RegistroApp />);
  await screen.findByRole('heading', { name: 'Hola, Mercedes' });
  return vista;
}

async function escribirNota(texto: string) {
  fireEvent.click(boton(/Escribir/));
  fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
    target: { value: texto },
  });
  fireEvent.click(boton('Listo'));
}

async function elegirYProcesar(nombre: string) {
  fireEvent.click(boton(nombre));
  fireEvent.click(boton(`Seguir con ${nombre}`));
  await screen.findByRole('heading', { name: '¿Está bien?' });
}

describe('RegistroApp', () => {
  beforeEach(() => {
    localStorage.clear();
    instalarMicrofono();
  });

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

  it('guarda una nota escrita en la API y sigue en Mis notas al recargar', async () => {
    const { unmount } = await ingresado();
    await escribirNota('Apiló tres bloques y aplaudió.');

    expect(screen.getByText('Nota lista')).toBeInTheDocument();
    // Solo la sala propia (la primera, Sala A): Vicente es de la Sala B.
    expect(screen.queryByRole('button', { name: 'Vicente P.' })).not.toBeInTheDocument();
    await elegirYProcesar('Benjamín S.');

    // El borrador de la API: aviso de lo simulado, el texto escrito, nivel 7 y Motor fino.
    expect(screen.getByText('Procesamiento simulado: aún no implementado')).toBeInTheDocument();
    expect(screen.getByText('Tu nota')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Nivel estimado' })).toHaveTextContent('Nivel 7');
    expect(screen.getByText(/estimación pedagógica, no un diagnóstico/)).toBeInTheDocument();
    const propuesta = screen.getByRole('region', { name: 'Prueba MF 7' });
    expect(within(propuesta).getByText('«Apiló tres bloques y aplaudió.»')).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(await screen.findByText('Nota guardada para Benjamín S.')).toBeInTheDocument();
    // Una sola captura por nota, aunque StrictMode ejecute dos veces los efectos.
    expect(capturasCreadas()).toHaveLength(1);
    expect(await screen.findByText('Hoy guardaste 1 nota')).toBeInTheDocument();

    unmount();
    conProveedores(<RegistroApp />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mis notas' }));
    const hoy = await screen.findByRole('region', { name: 'Hoy' });
    expect(within(hoy).getByText('Apiló tres bloques y aplaudió.')).toBeInTheDocument();
    expect(within(hoy).getByText('Motor fino')).toBeInTheDocument();
    expect(within(hoy).getByText('Guardada')).toBeInTheDocument();
  });

  it('graba un audio, lo sube a S3 y avisa que la transcripción no está implementada', async () => {
    await ingresado();
    fireEvent.click(boton('Grabar'));
    fireEvent.click(await screen.findByRole('button', { name: 'Terminar grabación' }));
    expect(await screen.findByText('Audio listo')).toBeInTheDocument();
    await elegirYProcesar('Tomás A.');

    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('Procesamiento simulado: aún no implementado');
    expect(aviso).toHaveTextContent(/Se recibió: Audio \(audio\/webm, 5 B\), guardado en S3/);
    expect(aviso).toHaveTextContent('Transcripción del audio: no implementado.');
    expect(aviso).toHaveTextContent('Nivel y manifestaciones: simulado.');
    expect(screen.getByLabelText('Audio grabado')).toBeInTheDocument();
    expect(screen.getByText('Texto de ejemplo (no es tu audio)')).toBeInTheDocument();
    expect(screen.getByText(EJEMPLO_AUDIO)).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(await screen.findByText('Nota guardada para Tomás A.')).toBeInTheDocument();
    expect(capturasCreadas()).toHaveLength(1);
  });

  it('explica si no hay permiso de micrófono y permite volver', async () => {
    instalarMicrofono({ permitir: false });
    await ingresado();
    fireEvent.click(boton(/Audio/));

    expect(await screen.findByText(/no dio permiso para usar el micrófono/)).toBeInTheDocument();
    fireEvent.click(boton('Cancelar'));
    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
  });

  it('sube una foto, avisa que la lectura no está implementada y permite descartarla', async () => {
    await ingresado();
    fireEvent.click(boton(/Foto/));
    fireEvent.change(screen.getByLabelText('Cámara'), {
      target: { files: [new File(['foto'], 'postit.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText('Foto lista')).toBeInTheDocument();
    await elegirYProcesar('Tomás A.');

    expect(screen.getByRole('alert')).toHaveTextContent('Lectura de la foto: no implementado.');
    expect(screen.getByRole('img', { name: 'Foto postit.jpg' })).toBeInTheDocument();
    expect(screen.getByText('Texto de ejemplo (no es tu foto)')).toBeInTheDocument();
    expect(screen.getByText(EJEMPLO_FOTO)).toBeInTheDocument();
    fireEvent.click(boton('Borrar nota'));

    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    fireEvent.click(boton('Mis notas'));
    expect(await screen.findByText(/Aún no tienes notas/)).toBeInTheDocument();
  });

  it('sin evidencia suficiente pide elegir manifestaciones del nivel', async () => {
    await ingresado();
    await escribirNota('Hoy llegó temprano al jardín.');
    await elegirYProcesar('Tomás A.');

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
  });

  it('muestra el error de la API si no puede crear la nota y permite reintentar', async () => {
    servidor.use(
      http.post('*/capturas', () =>
        HttpResponse.json({ message: 'Niño o niña no encontrado' }, { status: 404 }),
      ),
    );
    await ingresado();
    await escribirNota('Apiló tres bloques y aplaudió.');
    fireEvent.click(boton('Benjamín S.'));
    fireEvent.click(boton('Seguir con Benjamín S.'));

    expect(await screen.findByText('Niño o niña no encontrado')).toBeInTheDocument();
    servidor.resetHandlers();
    fireEvent.click(boton('Reintentar'));
    expect(await screen.findByRole('heading', { name: '¿Está bien?' })).toBeInTheDocument();
  });
});
