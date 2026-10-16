import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { aNino, type Manifestacion } from './api';
import { PanelSalas } from './PanelSalas';
import {
  MANIFESTACIONES,
  NINOS,
  NIVELES,
  capturasCreadas,
  conProveedores,
  reiniciarApi,
  sembrarConfirmada,
  servidor,
} from './prueba-api';
import type { NotaGuardada } from './registrar';
import { notasACsv } from './reporte';

beforeAll(() => servidor.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  servidor.resetHandlers();
  reiniciarApi();
});
afterAll(() => servidor.close());

const ninos = NINOS.map(aNino);
const catalogo = { niveles: NIVELES, manifestaciones: MANIFESTACIONES as Manifestacion[] };

/** Tres notas confirmadas en la API: dos de los últimos 7 días (Salas A y B) y una de hace 9. */
function renderizar({ directora = false } = {}) {
  sembrarConfirmada('NINO-T001', 'Señaló el gato del cuento, con calma.', 'MAN-L07-LV-01', 0);
  sembrarConfirmada('NINO-T004', 'Subió la rampa sin ayuda.', 'MAN-NM-L08-CM-01', 1);
  sembrarConfirmada('NINO-T002', 'Dijo «agua» y apuntó a la botella.', 'MAN-L07-LV-01', 9);
  return conProveedores(
    <PanelSalas
      ninos={ninos}
      salas={['SG-A', 'SG-B']}
      salaPropia="SG-A"
      catalogo={catalogo}
      ahora={new Date()}
      nombre="Claudia"
      directora={directora}
      onGuardada={() => undefined}
    />,
  );
}

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

describe('PanelSalas', () => {
  it('muestra las notas confirmadas de todas las salas de los últimos 7 días', async () => {
    renderizar();
    expect(screen.getByRole('heading', { name: 'Notas de las salas' })).toBeInTheDocument();
    expect(await screen.findByText('Últimos 7 días · 2 notas')).toBeInTheDocument();
    // La nota de hace 9 días queda fuera del periodo.
    expect(screen.queryByText(/apuntó a la botella/)).not.toBeInTheDocument();
  });

  it('filtra por sala', async () => {
    renderizar();
    await screen.findByText('Últimos 7 días · 2 notas');
    fireEvent.click(boton(/Sala B/));
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(1);
    expect(within(filas[0]!).getByText('Vicente P.')).toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días · 1 nota')).toBeInTheDocument();
  });
});

describe('Vista general del jardín', () => {
  it('la directora parte en la vista general con todas las salas y sus métricas', async () => {
    renderizar({ directora: true });
    expect(screen.getByRole('tab', { name: 'Vista general' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Vista general del jardín' })).toBeInTheDocument();
    const tabla = screen.getByRole('table', { name: 'Estado de las salas' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Sala A');
    expect(filas[0]).toHaveTextContent('20–20 meses');
    // Martina y Benjamín tienen notas de nivel 7; Tomás no tiene registros.
    await waitFor(() => expect(filas[0]).toHaveTextContent('7'));
    await waitFor(() => expect(boton('Descargar CSV')).toBeEnabled());
  });

  it('abre la sala elegida en Mi sala', () => {
    renderizar({ directora: true });
    fireEvent.click(boton('Ver Sala B'));
    expect(screen.getByRole('tab', { name: 'Mi sala' })).toHaveAttribute('aria-selected', 'true');
    expect(boton(/Sala B/)).toHaveAttribute('aria-pressed', 'true');
    expect(boton(/Vicente/)).toBeInTheDocument();
  });
});

describe('Datos incompletos', () => {
  /** La trayectoria de Tomás (Sala A) falla hasta que se llame a `sanar`. */
  function fallaTomas() {
    let falla = true;
    servidor.use(
      http.get('*/ninos/NINO-T003/trayectoria', () =>
        falla ? HttpResponse.json({ message: 'caída' }, { status: 500 }) : undefined,
      ),
    );
    return () => {
      falla = false;
    };
  }

  it('la vista general marca la sala incompleta, no calcula su rezago y bloquea el CSV', async () => {
    const sanar = fallaTomas();
    renderizar({ directora: true });
    expect(await screen.findByText(/Datos incompletos: no se pudieron cargar/)).toHaveTextContent(
      'los registros de 1 niño o niña',
    );
    const filas = within(screen.getByRole('table', { name: 'Estado de las salas' }))
      .getAllByRole('row')
      .slice(1);
    expect(filas[0]).toHaveTextContent('Datos incompletos: 1 sin cargar');
    expect(filas[0]).toHaveTextContent('Sin calcular');
    expect(filas[0]).toHaveTextContent('7 (parcial)');
    // Sala B cargó completa.
    expect(filas[1]).not.toHaveTextContent('parcial');
    expect(boton('Descargar CSV')).toBeDisabled();

    sanar();
    fireEvent.click(boton('Reintentar'));
    await waitFor(() => expect(boton('Descargar CSV')).toBeEnabled());
    expect(screen.queryByText(/Datos incompletos/)).not.toBeInTheDocument();
    expect(filas[0]).not.toHaveTextContent('Sin calcular');
  });

  it('Mi sala marca a quien no cargó y bloquea el CSV', async () => {
    fallaTomas();
    renderizar();
    fireEvent.click(screen.getByRole('tab', { name: 'Mi sala' }));
    await waitFor(() =>
      expect(boton(/Tomás/)).toHaveTextContent('No se pudieron cargar sus registros'),
    );
    expect(boton(/Martina/)).toHaveTextContent('Nivel prom. simple 7');
    const salaA = screen.getByRole('region', { name: 'Sala A' });
    expect(within(salaA).getByText('Sin calcular')).toBeInTheDocument();
    expect(boton('Descargar CSV')).toBeDisabled();
  });
});

describe('Nueva nota en PC', () => {
  it('sube la foto del post-it a S3, elige un niño de otra sala y la nota aparece en la tabla', async () => {
    renderizar();
    await screen.findByText('Últimos 7 días · 2 notas');
    fireEvent.click(boton('Nueva nota'));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva nota' });
    fireEvent.click(within(dialogo).getByRole('button', { name: /Foto/ }));

    const archivo = screen.getByLabelText('Archivo');
    fireEvent.change(archivo, {
      target: { files: [new File(['x'], 'notas.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText('Ese archivo no es una imagen.')).toBeInTheDocument();
    expect(boton('Seguir')).toBeDisabled();

    fireEvent.change(archivo, {
      target: { files: [new File(['x'], 'postit.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByText('postit.jpg');
    fireEvent.click(boton('Seguir'));

    expect(screen.getByRole('region', { name: 'Sala B' })).toBeInTheDocument();
    fireEvent.click(boton('Vicente P.'));
    fireEvent.click(boton('Seguir con Vicente P.'));

    expect(await screen.findByText('Esto leímos en tu post-it')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Lectura de la foto: no implementado.');
    // El diálogo tiene alto fijo: la revisión se desplaza dentro de él para llegar a «Está bien».
    const revision = within(screen.getByRole('dialog')).getByRole('main');
    expect(getComputedStyle(revision).overflowY).toBe('auto');
    fireEvent.click(boton('Está bien'));

    expect(await screen.findByText('Últimos 7 días · 3 notas')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Las 3 sembradas + la nueva: una sola captura creada desde la web.
    expect(capturasCreadas()).toHaveLength(4);
  });
});

describe('notasACsv', () => {
  it('genera una fila por nota con nivel y áreas, y escapa las comas', () => {
    const nota: NotaGuardada = {
      id: 'n1',
      nino: ninos[0]!,
      autor: 'Mercedes Rojas',
      formato: 'texto',
      estado: 'confirmada',
      creada: new Date(2026, 9, 15, 12),
      texto: 'Señaló el gato del cuento, con calma.',
      nucleos: ['LV'],
      nivel: 7,
    };
    const csv = notasACsv([nota]).split('\n');
    expect(csv[0]).toBe(
      'id_nota,fecha,sala,educadora,id_nino,nino,formato,nivel_estimado,areas,nota',
    );
    expect(csv).toHaveLength(2);
    expect(csv[1]).toContain(
      'Sala A,Mercedes Rojas,NINO-T001,Martina Pérez Soto,texto,7,Lenguaje,"Señaló el gato del cuento, con calma."',
    );
  });
});

describe('Pestañas de escritorio', () => {
  const pestana = (nombre: string) => screen.getByRole('tab', { name: nombre });

  function abrirMiSala() {
    renderizar();
    fireEvent.click(pestana('Mi sala'));
  }

  function escribirNota(dialogo: HTMLElement, texto: string) {
    fireEvent.click(within(dialogo).getByRole('button', { name: /Escribir/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Texto de la nota' }), {
      target: { value: texto },
    });
    fireEvent.click(boton('Listo'));
  }

  it('parte en Mis notas y cambia a Mi sala', () => {
    renderizar();
    expect(pestana('Mis notas')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Notas de las salas' })).toBeInTheDocument();

    fireEvent.click(pestana('Mi sala'));
    expect(pestana('Mi sala')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Mi sala' })).toBeInTheDocument();
  });

  it('agrupa por sala con «Todas las salas» e indica las áreas sin notas', async () => {
    abrirMiSala();
    const grupos = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(grupos).toEqual(['Sala A', 'Sala B']);
    expect(await screen.findByText('4 áreas sin notas')).toBeInTheDocument();
    expect(boton(/Martina/)).toHaveTextContent('4 áreas sin notas');
    // Nivel promedio simple de lo registrado (las notas de prueba son de nivel 7).
    expect(boton(/Martina/)).toHaveTextContent('Nivel prom. simple 7');
    expect(boton(/Tomás/)).not.toHaveTextContent('Nivel prom.');
    expect(
      screen.getByText(/Nivel promedio simple: .*todos con el mismo peso/),
    ).toBeInTheDocument();
    expect(boton('Descargar CSV')).toBeInTheDocument();
  });

  it('filtra Mi sala y comparte la sala con Mis notas', async () => {
    abrirMiSala();
    fireEvent.click(boton(/Sala B/));
    expect(boton(/Vicente/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Martina/ })).not.toBeInTheDocument();

    fireEvent.click(pestana('Mis notas'));
    expect(boton(/Sala B/)).toHaveAttribute('aria-pressed', 'true');
    await screen.findByText('Últimos 7 días · 1 nota');
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
  });

  it('abre la ficha con las áreas sin notas primero, sin niveles, y permite ver todas', async () => {
    abrirMiSala();
    fireEvent.click(boton(/Martina/));

    expect(screen.getByRole('heading', { name: 'Martina P.' })).toBeInTheDocument();
    expect(await screen.findAllByText('Sin notas aún. Buen momento para observar.')).toHaveLength(
      4,
    );
    const regiones = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regiones[0]).toBe('Convivencia');
    expect(screen.queryByText(/nivel|rezago/i)).not.toBeInTheDocument();
    // Retroalimentación: un próximo paso por área según lo anotado (aquí, el tramo siguiente).
    const retro = screen.getByRole('region', { name: 'Retroalimentación' });
    expect(within(retro).getByText(/Señaló el gato del cuento/)).toBeInTheDocument();
    expect(within(retro).getAllByText(/«Prueba LV 8»/)).toHaveLength(1);

    // 4 observaciones del dataset + 1 confirmada en la app.
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Registrada en la app');
    fireEvent.click(boton('Ver las 5'));
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });

  it('vuelve a Mi sala con la sala elegida, también desde la pestaña', () => {
    abrirMiSala();
    fireEvent.click(boton(/Sala B/));
    fireEvent.click(boton(/Vicente/));
    fireEvent.click(boton('Volver a Mi sala'));
    expect(boton(/Sala B/)).toHaveAttribute('aria-pressed', 'true');
    expect(boton(/Vicente/)).toBeInTheDocument();

    fireEvent.click(boton(/Vicente/));
    fireEvent.click(pestana('Mi sala'));
    expect(screen.getByRole('heading', { name: 'Mi sala' })).toBeInTheDocument();
  });

  it('Nueva nota desde la ficha queda para ese niño o niña sin elegirlo', async () => {
    abrirMiSala();
    fireEvent.click(boton(/Vicente/));
    fireEvent.click(boton('Nueva nota para Vicente P.'));
    escribirNota(screen.getByRole('dialog'), 'Apiló cinco bloques y aplaudió.');

    expect(screen.queryByText('¿De quién es?')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Está bien' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Vicente P.' })).toBeInTheDocument();
    // La observación confirmada vuelve por la trayectoria de la API, con el texto como nota breve.
    expect((await screen.findAllByText('Apiló cinco bloques y aplaudió.'))[0]).toBeInTheDocument();
  });

  it('Nueva nota de la cabecera pide elegir sin nadie preseleccionado', () => {
    abrirMiSala();
    fireEvent.click(boton('Nueva nota'));
    escribirNota(screen.getByRole('dialog'), 'Apiló cinco bloques y aplaudió.');

    expect(screen.getByText('¿De quién es?')).toBeInTheDocument();
    expect(boton('Elige un niño o niña')).toBeDisabled();
  });
});
