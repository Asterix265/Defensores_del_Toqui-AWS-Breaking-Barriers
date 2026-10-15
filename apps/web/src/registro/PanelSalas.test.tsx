import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { aNino, type Manifestacion } from './api';
import { PanelSalas } from './PanelSalas';
import {
  MANIFESTACIONES,
  NINOS,
  NIVELES,
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

function renderizar() {
  sembrarConfirmada('NINO-T001', 'Señaló el gato del cuento, con calma.', 'MAN-L07-LC-01', 0);
  sembrarConfirmada('NINO-T004', 'Subió la rampa sin ayuda.', 'MAN-L09-MG-01', 1);
  sembrarConfirmada('NINO-T002', 'Dijo «agua» y apuntó a la botella.', 'MAN-L07-LC-01', 9);
  return conProveedores(
    <PanelSalas
      ninos={ninos}
      salas={['SG-A', 'SG-B']}
      catalogo={catalogo}
      ahora={new Date()}
      nombre="Claudia"
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
    fireEvent.click(boton('Está bien'));

    expect(await screen.findByText('Últimos 7 días · 3 notas')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
      dominios: ['lenguaje_comunicacion'],
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
