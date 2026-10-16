import { describe, expect, it } from 'vitest';
import type { Manifestacion, ObservacionApi } from './api';
import { sugerenciasDe } from './sugerencias';

/** Manifestación sintética de Lenguaje en Sala Cuna: tres por descriptor (como el dataset). */
function m(nivel: number, letra: string): Manifestacion {
  return {
    id: `MAN-LV-${nivel}${letra}`,
    idDescriptor: `RUB-SC-LV-0${nivel}`,
    nucleo: 'LV',
    nivelEducativo: 'SC',
    nivel,
    tipo: letra === 'a' ? 'conducta_descriptor' : 'ejemplo_ilustrativo',
    textoObservable: `Conducta ${nivel}${letra}`,
  };
}

const CATALOGO = [m(7, 'a'), m(7, 'b'), m(7, 'c'), m(8, 'a'), m(8, 'b'), m(8, 'c')];
const nino = { nivelEducativo: 'SC' as const };

function nota(
  id: string,
  fecha: string,
  texto: string,
  evidencias: { manifestacion: Manifestacion; fragmento: string | null; parcial?: boolean }[],
): ObservacionApi {
  return {
    id,
    fecha,
    formato: 'texto',
    origen: 'app',
    notaBreve: null,
    textoObservacion: texto,
    manifestaciones: evidencias.map((e) => e.manifestacion),
    evidencias: evidencias.map((e, i) => ({
      id: `${id}-${i}`,
      manifestacion: e.manifestacion,
      fragmento: e.fragmento,
      alcance: e.parcial ? 'parcial_otro_descriptor' : 'componente_observado',
    })),
  };
}

const primera = (observaciones: ObservacionApi[]) =>
  sugerenciasDe(observaciones, nino, CATALOGO)[0]!;

describe('sugerenciasDe', () => {
  it('cita lo que dijo la tía y pide completar lo que falta de la misma conducta', () => {
    const s = primera([
      nota('O1', '2026-10-10', 'En la ronda dijo «más agua» señalando el vaso.', [
        { manifestacion: m(7, 'a'), fragmento: 'dijo «más agua»' },
      ]),
    ]);
    expect(s.cita).toBe('dijo «más agua»');
    expect(s.observadas.map((x) => x.id)).toEqual(['MAN-LV-7a']);
    expect(s.tipo).toBe('completar');
    expect(s.sugeridas.map((x) => x.id)).toEqual(['MAN-LV-7b', 'MAN-LV-7c']);
  });

  it('si la nota lo muestra solo en parte, sugiere afianzar esa conducta', () => {
    const s = primera([
      nota('O1', '2026-10-10', 'Intentó decir «agua», pero solo dijo «a».', [
        { manifestacion: m(7, 'a'), fragmento: 'solo dijo «a»', parcial: true },
      ]),
    ]);
    expect(s.tipo).toBe('afianzar');
    expect(s.sugeridas.map((x) => x.id)).toEqual(['MAN-LV-7a', 'MAN-LV-7b']);
  });

  it('con la conducta completa en las notas, sugiere lo siguiente de la rúbrica sin repetir', () => {
    const s = primera([
      nota('O1', '2026-09-01', 'Nombró tres animales.', [
        { manifestacion: m(7, 'b'), fragmento: null },
        { manifestacion: m(7, 'c'), fragmento: null },
      ]),
      nota('O2', '2026-09-20', 'Contó lo que hizo el fin de semana.', [
        { manifestacion: m(8, 'a'), fragmento: null },
      ]),
      nota('O3', '2026-10-10', 'Pidió agua con una frase.', [
        { manifestacion: m(7, 'a'), fragmento: null },
      ]),
    ]);
    // La nota más reciente (O3) manda; sin cita vinculada se muestra su texto.
    expect(s.nota.id).toBe('O3');
    expect(s.cita).toBe('Pidió agua con una frase.');
    expect(s.tipo).toBe('avanzar');
    // 8a ya se observó en O2.
    expect(s.sugeridas.map((x) => x.id)).toEqual(['MAN-LV-8b', 'MAN-LV-8c']);
  });

  it('dos notas distintas del mismo tramo llevan a pasos distintos', () => {
    const completa = primera([
      nota('O1', '2026-10-10', 'Dijo «agua».', [{ manifestacion: m(7, 'a'), fragmento: null }]),
    ]);
    const parcial = primera([
      nota('O1', '2026-10-10', 'Casi dijo «agua».', [
        { manifestacion: m(7, 'a'), fragmento: null, parcial: true },
      ]),
    ]);
    expect(completa.tipo).not.toBe(parcial.tipo);
  });

  it('en lo último de la rúbrica no inventa un paso', () => {
    const s = primera([
      nota(
        'O1',
        '2026-10-10',
        'Relató un cuento completo.',
        [8, 8, 8].map((n, i) => ({ manifestacion: m(n, 'abc'[i]!), fragmento: null })),
      ),
    ]);
    expect(s.tipo).toBe('tope');
    expect(s.sugeridas).toEqual([]);
  });

  it('un área sin notas no tiene sugerencia', () => {
    expect(sugerenciasDe([], nino, CATALOGO)).toEqual([]);
  });
});
