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
