import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import {
  CLAVE_SESION_LOCAL,
  capturasCreadas,
  conSesion,
  EJEMPLO_AUDIO,
  EJEMPLO_FOTO,
  conProveedores,
  instalarMicrofono,
  reiniciarApi,
  servidor,
} from './prueba-api';
import { AVISO_SIN_JARDIN, RegistroApp, nombreVisible } from './RegistroApp';

describe('nombreVisible', () => {
  it.each([
    [{ nombre: 'Mercedes Soto', email: 'x@integra.cl' }, 'Mercedes'],
    [{ nombre: '  Ana  María ', email: null }, 'Ana'],
    [{ nombre: '', email: 'mercedes.soto@integra.cl' }, 'Mercedes'],
    [{ nombre: null, email: 'rosa_p@integra.cl' }, 'Rosa'],
    [{ nombre: null, email: null }, 'tía'],
  ])('%o → %s', (me, esperado) => {
    expect(nombreVisible(me)).toBe(esperado);
  });
});

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  reiniciarApi();
});
afterAll(() => servidor.close());

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

async function ingresado() {
  conSesion();
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

  it('ingresa con correo y contraseña, carga el jardín desde la API y recuerda la sesión', async () => {
    const { unmount } = conProveedores(<RegistroApp />);

    const correo = await screen.findByRole('textbox', { name: 'Correo' });
    expect(boton('Entrar')).toBeDisabled();
    fireEvent.change(correo, { target: { value: 'mercedes@integra.cl' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'una clave' } });
    fireEvent.click(boton('Entrar'));

    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();

    unmount();
    conProveedores(<RegistroApp />);
    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
  });

  it('avisa si no puede conectarse con la API', async () => {
    servidor.use(http.get('*/ninos', () => new HttpResponse(null, { status: 500 })));
    conSesion();
    conProveedores(<RegistroApp />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con la API');
  });

  it('cierra sesión tras confirmar y al recargar sigue en el ingreso', async () => {
    const { unmount } = await ingresado();
    localStorage.setItem('toqui.registro.sala', 'Sala Prueba');

    fireEvent.click(boton('Cerrar sesión'));
    const dialogo = await screen.findByRole('dialog', { name: '¿Cerrar sesión?' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('form', { name: 'Ingreso' })).toBeInTheDocument();
    expect(localStorage.getItem(CLAVE_SESION_LOCAL)).toBeNull();
    expect(localStorage.getItem('toqui.registro.sala')).toBeNull();

    unmount();
    conProveedores(<RegistroApp />);
    expect(await screen.findByRole('form', { name: 'Ingreso' })).toBeInTheDocument();
  });

  it('cancelar el cierre de sesión deja todo como estaba', async () => {
    await ingresado();

    fireEvent.click(boton('Cerrar sesión'));
    const dialogo = await screen.findByRole('dialog', { name: '¿Cerrar sesión?' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    expect(localStorage.getItem(CLAVE_SESION_LOCAL)).not.toBeNull();
  });

  it('una cuenta sin jardín vuelve al ingreso explicando el motivo', async () => {
    servidor.use(http.get('*/me', () => new HttpResponse(null, { status: 403 })));
    conSesion();
    conProveedores(<RegistroApp />);

    expect(await screen.findByText(AVISO_SIN_JARDIN)).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Ingreso' })).toBeInTheDocument();
  });

  it('un 403 de los niños y niñas también se trata como cuenta sin jardín', async () => {
    servidor.use(http.get('*/ninos', () => new HttpResponse(null, { status: 403 })));
    conSesion();
    conProveedores(<RegistroApp />);

    expect(await screen.findByText(AVISO_SIN_JARDIN)).toBeInTheDocument();
  });

  it('guarda una nota escrita en la API y sigue en Mis notas al recargar', async () => {
    const { unmount } = await ingresado();
    await escribirNota('Apiló tres bloques y aplaudió.');

    expect(screen.getByText('Nota lista')).toBeInTheDocument();
    // Todo el jardín, agrupado por sala: la propia (Sala A) primero y Vicente en la Sala B.
    const grupos = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(grupos.slice(0, 2)).toEqual(['Sala A', 'Sala B']);
    expect(
      within(screen.getByRole('region', { name: 'Sala B' })).getByRole('button', {
        name: 'Vicente P.',
      }),
    ).toBeInTheDocument();
    await elegirYProcesar('Benjamín S.');

    // El borrador de la API: aviso de lo simulado, el texto escrito, nivel 7 y Movimiento.
    expect(screen.getByText('Procesamiento simulado: aún no implementado')).toBeInTheDocument();
    expect(screen.getByText('Tu nota')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Nivel estimado' })).toHaveTextContent('Nivel 7');
    expect(screen.getByText(/estimación pedagógica, no un diagnóstico/)).toBeInTheDocument();
    const propuesta = screen.getByRole('region', { name: 'Prueba CM 7' });
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
    expect(within(hoy).getByText('Movimiento')).toBeInTheDocument();
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
    // Borrar pide confirmación: «Volver a la nota» la conserva.
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a la nota' }));
    await waitFor(() => expect(screen.queryByText('¿Borrar la nota?')).not.toBeInTheDocument());
    expect(screen.getByText(EJEMPLO_FOTO)).toBeInTheDocument();
    fireEvent.click(boton('Borrar nota'));
    fireEvent.click(await screen.findByRole('button', { name: 'Borrar' }));

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
    // Sin propuesta parte del nivel 1: los niveles por núcleo no tienen edades.
    expect(screen.getByRole('status', { name: 'Nivel estimado' })).toHaveTextContent('Nivel 1');
    const catalogo = screen.getByRole('region', { name: 'Catálogo de manifestaciones' });
    expect(within(catalogo).queryByText('Prueba IA 2')).not.toBeInTheDocument();
    // Solo el catálogo de Sala Cuna, el nivel educativo de Tomás.
    expect(within(catalogo).queryByText(/Prueba NM/)).not.toBeInTheDocument();
    fireEvent.click(within(catalogo).getByRole('button', { name: /Prueba IA 1/ }));
    expect(boton('Está bien')).toBeEnabled();

    // Cambiar el nivel quita lo elegido: la API exige manifestaciones del nivel confirmado.
    fireEvent.click(boton('Subir nivel'));
    expect(screen.getByRole('status', { name: 'Nivel estimado' })).toHaveTextContent('Nivel 2');
    expect(boton('Está bien')).toBeDisabled();
    fireEvent.click(within(catalogo).getByRole('button', { name: /Prueba IA 2/ }));
    fireEvent.click(boton('Quitar «Prueba IA 2»'));
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
