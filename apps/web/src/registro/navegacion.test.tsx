import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { aNino, ordenarSalas, type Manifestacion } from './api';
import { PanelSalas } from './PanelSalas';
import {
  MANIFESTACIONES,
  NINOS,
  NIVELES,
  capturasCreadas,
  conProveedores,
  conSesion,
  instalarMicrofono,
  reiniciarApi,
  sembrarConfirmada,
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
  conSesion();
  conProveedores(<RegistroApp />);
  await screen.findByRole('heading', { name: 'Hola, Mercedes' });
}

/** Nota escrita de Benjamín hasta la revisión, sin confirmarla. */
async function hastaLaRevision(texto = 'Apiló tres bloques y aplaudió.') {
  fireEvent.click(boton(/Escribir/));
  fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
    target: { value: texto },
  });
  fireEvent.click(boton('Listo'));
  fireEvent.click(boton('Benjamín S.'));
  fireEvent.click(boton('Seguir con Benjamín S.'));
  await screen.findByRole('heading', { name: '¿Está bien?' });
}

/** Cierra la revisión con la × y confirma dejarla para después. */
async function dejarParaDespues() {
  fireEvent.click(boton('Cerrar revisión'));
  const dialogo = await screen.findByRole('dialog', { name: '¿Dejar la revisión para después?' });
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Dejar para después' }));
}

describe('Atrás en el celular', () => {
  beforeEach(() => {
    localStorage.clear();
    instalarMicrofono();
  });

  it('vuelve de la ficha a Mi sala y de Mi sala a Inicio sin salir de la app', async () => {
    await ingresado();
    fireEvent.click(boton('Mi sala'));
    fireEvent.click(boton(/Martina/));
    await screen.findByRole('heading', { name: 'Martina P.' });

    window.history.back();
    expect(await screen.findByRole('heading', { name: 'Mi sala' })).toBeInTheDocument();
    window.history.back();
    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
  });

  it('pide confirmar antes de perder una grabación en curso', async () => {
    await ingresado();
    fireEvent.click(boton('Grabar'));
    await waitFor(() => expect(boton('Terminar grabación')).toBeEnabled());

    window.history.back();
    const dialogo = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Seguir con la nota' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Nota de audio' })).toBeInTheDocument();

    fireEvent.click(boton('Cancelar'));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })).getByRole(
        'button',
        { name: 'Salir' },
      ),
    );
    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    expect(capturasCreadas()).toHaveLength(0);
  });

  it('una revisión cerrada queda «Sin revisar» y se retoma desde Mis notas', async () => {
    await ingresado();
    await hastaLaRevision();
    await dejarParaDespues();

    expect(await screen.findByRole('heading', { name: 'Hola, Mercedes' })).toBeInTheDocument();
    fireEvent.click(boton('Mis notas'));
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar nota de Benjamín S.' }));
    expect(await screen.findByRole('heading', { name: '¿Está bien?' })).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(await screen.findByText('Nota guardada para Benjamín S.')).toBeInTheDocument();
    expect(await screen.findByText('Guardada')).toBeInTheDocument();
    expect(capturasCreadas()).toHaveLength(1);
    expect(capturasCreadas()[0]!.estado).toBe('confirmada');
  });

  it('con transcripción real no rotula el texto como ejemplo y muestra el audio guardado', async () => {
    await ingresado();
    fireEvent.click(boton('Grabar'));
    fireEvent.click(await screen.findByRole('button', { name: 'Terminar grabación' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Tomás A.' }));
    fireEvent.click(boton('Seguir con Tomás A.'));
    await screen.findByText('Texto de ejemplo (no es tu audio)');
    await dejarParaDespues();

    // Como si Transcribe y Claude hubieran procesado la nota de verdad.
    capturasCreadas()[0]!.borrador!.procesamiento!.simulado = false;
    fireEvent.click(await screen.findByRole('button', { name: 'Mis notas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar nota de Tomás A.' }));

    expect(await screen.findByText('Lo que entendimos de tu audio')).toBeInTheDocument();
    expect(screen.queryByText(/Texto de ejemplo/)).not.toBeInTheDocument();
    expect(screen.getByText('Listo: revisamos tu audio')).toBeInTheDocument();
    expect(await screen.findByLabelText('Audio grabado')).toBeInTheDocument();
  });
});

const ninos = NINOS.map(aNino);
const catalogo = { niveles: NIVELES, manifestaciones: MANIFESTACIONES as Manifestacion[] };

function panel() {
  return conProveedores(
    <PanelSalas
      ninos={ninos}
      salas={['SG-A', 'SG-B']}
      salaPropia="SG-A"
      catalogo={catalogo}
      ahora={new Date()}
      nombre="Claudia"
      onGuardada={() => undefined}
    />,
  );
}

describe('Panel de escritorio', () => {
  it('Atrás cierra el diálogo de nueva nota y deja la pestaña', async () => {
    panel();
    fireEvent.click(boton('Nueva nota'));
    expect(screen.getByRole('dialog', { name: 'Nueva nota' })).toBeInTheDocument();

    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Notas de las salas' })).toBeInTheDocument();
  });

  it('Escape con texto escrito pide confirmar y no cierra si se sigue', async () => {
    panel();
    fireEvent.click(boton('Nueva nota'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Escribir/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
      target: { value: 'Apiló cinco bloques.' },
    });

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Nueva nota' }), { key: 'Escape' });
    const confirmacion = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' });
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Seguir con la nota' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '¿Salir sin guardar?' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('textbox', { name: 'Texto de la nota' })).toHaveValue(
      'Apiló cinco bloques.',
    );
  });

  it('lista las notas «Por revisar» y las abre en el diálogo', async () => {
    panel();
    fireEvent.click(boton('Nueva nota'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Escribir/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
      target: { value: 'Apiló cinco bloques y aplaudió.' },
    });
    fireEvent.click(boton('Listo'));
    fireEvent.click(boton('Vicente P.'));
    fireEvent.click(boton('Seguir con Vicente P.'));
    await screen.findByRole('heading', { name: '¿Está bien?' });
    await dejarParaDespues();

    const porRevisar = await screen.findByRole('region', { name: 'Por revisar' });
    fireEvent.click(within(porRevisar).getByRole('button', { name: 'Revisar nota de Vicente P.' }));
    expect(await screen.findByRole('dialog', { name: 'Revisar nota' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Está bien' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Por revisar' })).toBeNull());
    expect(await screen.findByText('Últimos 7 días · 1 nota')).toBeInTheDocument();
  });

  it('una fila de la tabla abre el detalle de la nota', async () => {
    sembrarConfirmada('NINO-T001', 'Señaló el gato del cuento.', 'MAN-L07-LV-01', 0);
    panel();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver nota de Martina P.' }));

    const detalle = await screen.findByRole('dialog', { name: 'Nota de Martina P.' });
    expect(within(detalle).getByText('Señaló el gato del cuento.')).toBeInTheDocument();
    expect(within(detalle).getByText(/Nivel 7/)).toBeInTheDocument();
    expect(within(detalle).getByText('Registró Mercedes Rojas')).toBeInTheDocument();
  });
});

describe('App completa en pantalla ancha', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    localStorage.clear();
    // Todas las consultas de medios coinciden: `useMediaQuery` elige el panel de escritorio.
    window.matchMedia = ((consulta: string) => ({
      matches: true,
      media: consulta,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('Atrás con una nota escrita pide confirmar en vez de cerrar el diálogo', async () => {
    conSesion();
    conProveedores(<RegistroApp />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva nota' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Escribir/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
      target: { value: 'Apiló cinco bloques.' },
    });

    window.history.back();
    expect(await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })).toBeInTheDocument();
    // Detrás de la confirmación el diálogo de la nota sigue abierto (oculto a la accesibilidad).
    expect(screen.getByRole('textbox', { name: 'Texto de la nota', hidden: true })).toHaveValue(
      'Apiló cinco bloques.',
    );
  });
});

describe('ordenarSalas', () => {
  it('ordena por edad (Sala Cuna, Nivel Medio, Transición) y número', () => {
    expect(ordenarSalas(['NM-02', 'TR-01', 'SC-02', 'NM-01', 'SC-01', 'SG-A'])).toEqual([
      'SC-01',
      'SC-02',
      'NM-01',
      'NM-02',
      'TR-01',
      'SG-A',
    ]);
  });
});
