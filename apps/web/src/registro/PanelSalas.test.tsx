import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { notasDeEjemplo, type Nota } from './datos';
import { PanelSalas } from './PanelSalas';
import { notasACsv } from './reporte';
import { tema } from './tema';

const ahora = new Date(2026, 9, 15, 12, 0);
const notas = notasDeEjemplo(ahora);

function PanelConEstado() {
  const [lista, setLista] = useState<Nota[]>(notas);
  return (
    <PanelSalas
      notas={lista}
      ahora={ahora}
      nombre="Claudia"
      onGuardar={(nota) => setLista((previas) => [nota, ...previas])}
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
    expect(screen.getByText('Últimos 7 días · 8 notas')).toBeInTheDocument();
    // La nota de hace 9 días queda fuera del periodo.
    expect(screen.queryByText(/apuntó a la botella/)).not.toBeInTheDocument();
  });

  it('filtra por sala', () => {
    renderizar();
    fireEvent.click(boton(/Medio Menor/));
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(2);
    expect(within(filas[0]!).getByText('Vicente')).toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días · 2 notas')).toBeInTheDocument();
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

    expect(screen.getByRole('region', { name: 'Medio Menor' })).toBeInTheDocument();
    fireEvent.click(boton('Vicente'));
    fireEvent.click(boton('Seguir con Vicente'));

    expect(screen.getByText('Esto leímos en tu post-it')).toBeInTheDocument();
    expect(screen.getByText('postit.jpg')).toBeInTheDocument();
    fireEvent.click(boton('Está bien'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días · 9 notas')).toBeInTheDocument();
    expect(screen.getAllByText('Tía Claudia', { exact: false })).toHaveLength(1);
  });
});

describe('notasACsv', () => {
  it('genera una fila por nota y escapa las comas', () => {
    const csv = notasACsv(notas.slice(0, 2)).split('\n');
    expect(csv[0]).toBe('id_nota,fecha,sala,educadora,nino,formato,area,nota');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain('Sala Cuna Mayor,Mercedes,Sofía,audio,Socioemocional');
  });
});
