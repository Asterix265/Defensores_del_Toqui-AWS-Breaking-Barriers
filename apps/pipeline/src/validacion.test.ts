import { describe, expect, it } from 'vitest';
import { CATALOGO } from './pruebas/datos.js';
import { validarClasificacion } from './validacion.js';

const TEXTO = 'Apiló cinco bloques sin ayuda y sonrió.';

describe('validarClasificacion', () => {
  it('acepta una propuesta del catálogo con cita literal', () => {
    const r = validarClasificacion(
      {
        nivelSugerido: 4,
        evidenciaInsuficiente: false,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Apiló cinco bloques' }],
      },
      TEXTO,
      CATALOGO,
    );
    expect(r.ok).toBe(true);
  });

  it('rechaza ids fuera del catálogo, de otro nivel y citas inventadas', () => {
    const r = validarClasificacion(
      {
        nivelSugerido: 4,
        evidenciaInsuficiente: false,
        manifestaciones: [
          { idManifestacion: 'M-9-XX-1', cita: 'Apiló' },
          { idManifestacion: 'M-5-CM-1', cita: 'Apiló' },
          { idManifestacion: 'M-4-CM-1', cita: 'Construyó una torre' },
        ],
      },
      TEXTO,
      CATALOGO,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problemas).toEqual([
      'M-9-XX-1 no está en el catálogo permitido',
      'M-5-CM-1 no es del nivel sugerido',
      'la cita de M-4-CM-1 no aparece literalmente en el texto',
    ]);
  });

  it('exige coherencia con la evidencia insuficiente', () => {
    const r = validarClasificacion(
      {
        nivelSugerido: 4,
        evidenciaInsuficiente: true,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Apiló' }],
      },
      TEXTO,
      CATALOGO,
    );
    expect(r.ok).toBe(false);
  });

  it('rechaza una salida que no cumple el esquema', () => {
    const r = validarClasificacion({ nivel: 'cuatro' }, TEXTO, CATALOGO);
    expect(r.ok).toBe(false);
  });
});
