import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { notasDeEjemplo } from './datos';
import { PanelSalas } from './PanelSalas';
import { notasACsv } from './reporte';
import { tema } from './tema';

const ahora = new Date(2026, 9, 15, 12, 0);
const notas = notasDeEjemplo(ahora);

function renderizar() {
  return render(
    <ThemeProvider theme={tema}>
      <PanelSalas notas={notas} ahora={ahora} nombre="Claudia" />
    </ThemeProvider>,
  );
}

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
    fireEvent.click(screen.getByRole('button', { name: /Medio Menor/ }));
    const filas = screen.getAllByRole('row').slice(1);
    expect(filas).toHaveLength(2);
    expect(within(filas[0]!).getByText('Vicente')).toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días · 2 notas')).toBeInTheDocument();
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
