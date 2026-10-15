import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { aNino, type Manifestacion } from './api';
import type { Nota } from './datos';
import { PanelSalas } from './PanelSalas';
import { MANIFESTACIONES, NINOS, NIVELES } from './prueba-api';
import { notasACsv } from './reporte';
import { tema } from './tema';

const ahora = new Date(2026, 9, 15, 12, 0);
const ninos = NINOS.map(aNino);
const catalogo = { niveles: NIVELES, manifestaciones: MANIFESTACIONES as Manifestacion[] };
const manifestacion = (id: string) => catalogo.manifestaciones.find((m) => m.id === id)!;

function nota(id: string, ninoId: string, dias: number, texto: string, idMan: string): Nota {
  const creada = new Date(ahora);
  creada.setDate(creada.getDate() - dias);
  return {
    id,
    nino: ninos.find((n) => n.id === ninoId)!,
    educadora: 'Mercedes',
    formato: 'texto',
    creada,
    texto,
    nivel: manifestacion(idMan).nivel,
    manifestaciones: [{ manifestacion: manifestacion(idMan), cita: null }],
    sugerencia: { nivel: null, manifestaciones: [] },
  };
}

const notas = [
  nota('n1', 'NINO-T001', 0, 'Señaló el gato del cuento, con calma.', 'MAN-L07-LC-01'),
  nota('n2', 'NINO-T004', 1, 'Subió la rampa sin ayuda.', 'MAN-L09-MG-01'),
  nota('n3', 'NINO-T002', 9, 'Dijo «agua» y apuntó a la botella.', 'MAN-L07-LC-01'),
];

function PanelConEstado() {
  const [lista, setLista] = useState<Nota[]>(notas);
  return (
    <PanelSalas
      ninos={ninos}
      salas={['SG-A', 'SG-B']}
      catalogo={catalogo}
      notas={lista}
      ahora={ahora}
      nombre="Claudia"
      onGuardar={(n) => setLista((previas) => [n, ...previas])}
    />
  );
}

function renderizar() {
  return render(
    <ThemeProvider theme={tema}>
      <PanelConEstado />
    </ThemeProvider>,
  );
}

const boton = (nombre: string | RegExp) => screen.getByRole('button', { name: nombre });

describe('PanelSalas', () => {
  it('muestra las notas de todas las salas de los últimos 7 días', () => {
    renderizar();
    expect(screen.getByRole('heading', { name: 'Notas de las salas' })).toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días · 2 notas')).toBeInTheDocument();
    // La nota de hace 9 días queda fuera del periodo.
    expect(screen.queryByText(/apuntó a la botella/)).not.toBeInTheDocument();
  });

  it('filtra por sala', () => {
    renderizar();
    fireEvent.click(boton(/Sala B/));
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(1);
    expect(within(filas[0]!).getByText('Vicente P.')).toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días · 1 nota')).toBeInTheDocument();
  });
});

describe('Nueva nota en PC', () => {
  it('sube la foto del post-it, elige un niño de otra sala y la nota aparece en la tabla', () => {
    renderizar();
    fireEvent.click(boton('Nueva nota'));
    const dialogo = screen.getByRole('dialog', { name: 'Nueva nota' });
    fireEvent.click(within(dialogo).getByRole('button', { name: /Foto/ }));

    const archivo = screen.getByLabelText('Archivo');
    fireEvent.change(archivo, {
      target: { files: [new File(['x'], 'notas.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByText('Ese archivo no es una imagen.')).toBeInTheDocument();
    expect(boton('Seguir')).toBeDisabled();

    fireEvent.change(archivo, {
      target: { files: [new File(['x'], 'postit.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(boton('Seguir'));

    expect(screen.getByRole('region', { name: 'Sala B' })).toBeInTheDocument();
    fireEvent.click(boton('Vicente P.'));
    fireEvent.click(boton('Seguir con Vicente P.'));

    expect(screen.getByText('Esto leímos en tu post-it')).toBeInTheDocument();
    expect(screen.getByText('postit.jpg')).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días · 3 notas')).toBeInTheDocument();
    expect(screen.getAllByText('Tía Claudia', { exact: false })).toHaveLength(1);
  });
});

describe('notasACsv', () => {
  it('genera una fila por nota con nivel y manifestaciones, y escapa las comas', () => {
    const csv = notasACsv(notas.slice(0, 2)).split('\n');
    expect(csv[0]).toBe(
      'id_nota,fecha,sala,educadora,id_nino,nino,formato,nivel_estimado,areas,manifestaciones,nota',
    );
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain(
      'Sala A,Mercedes,NINO-T001,Martina Pérez Soto,texto,7,Lenguaje,MAN-L07-LC-01,"Señaló el gato del cuento, con calma."',
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

  it('agrupa por sala con «Todas las salas» e indica las áreas sin notas', () => {
    abrirMiSala();
    const grupos = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(grupos).toEqual(['Sala Cuna Mayor', 'Sala Cuna Menor', 'Medio Menor']);
    expect(boton(/Martina/)).toHaveTextContent('1 área sin notas');
  });

  it('filtra Mi sala y comparte la sala con Mis notas', () => {
    abrirMiSala();
    fireEvent.click(boton(/Medio Menor/));
    expect(boton(/Vicente/)).toBeInTheDocument();
    expect(boton(/Florencia/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Martina/ })).not.toBeInTheDocument();

    fireEvent.click(pestana('Mis notas'));
    expect(boton(/Medio Menor/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(2);
  });

  it('abre la ficha con las áreas sin notas primero, sin niveles, y permite ver todas', () => {
    abrirMiSala();
    fireEvent.click(boton(/Martina/));

    expect(screen.getByRole('heading', { name: 'Martina' })).toBeInTheDocument();
    const regiones = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regiones[0]).toBe('Motor grueso');
    expect(screen.getByText('Sin notas aún. Buen momento para observar.')).toBeInTheDocument();
    expect(screen.queryByText(/nivel|rezago/i)).not.toBeInTheDocument();

    expect(screen.getAllByRole('article')).toHaveLength(3);
    fireEvent.click(boton('Ver las 4'));
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  it('vuelve a Mi sala con la sala elegida, también desde la pestaña', () => {
    abrirMiSala();
    fireEvent.click(boton(/Medio Menor/));
    fireEvent.click(boton(/Vicente/));
    fireEvent.click(boton('Volver a Mi sala'));
    expect(boton(/Medio Menor/)).toHaveAttribute('aria-pressed', 'true');
    expect(boton(/Florencia/)).toBeInTheDocument();

    fireEvent.click(boton(/Florencia/));
    fireEvent.click(pestana('Mi sala'));
    expect(screen.getByRole('heading', { name: 'Mi sala' })).toBeInTheDocument();
  });

  it('Nueva nota desde la ficha queda para ese niño o niña sin elegirlo', () => {
    abrirMiSala();
    fireEvent.click(boton(/Vicente/));
    fireEvent.click(boton('Nueva nota para Vicente'));
    escribirNota(screen.getByRole('dialog'), 'Apiló cinco bloques y aplaudió.');

    expect(screen.queryByText('¿De quién es?')).not.toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vicente' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Apiló cinco bloques');
  });

  it('Nueva nota de la cabecera pide elegir sin nadie preseleccionado', () => {
    abrirMiSala();
    fireEvent.click(boton('Nueva nota'));
    escribirNota(screen.getByRole('dialog'), 'Apiló cinco bloques y aplaudió.');

    expect(screen.getByText('¿De quién es?')).toBeInTheDocument();
    expect(boton('Elige un niño o niña')).toBeDisabled();
  });
});
