import type { MensajeCaptura } from '@toqui/shared';
import { describe, expect, it } from 'vitest';
import { declararProcesamiento } from './procesamiento.js';
import { mensajeArchivo, mensajeTexto } from './pruebas/datos.js';

const FAKE = { proveedor: 'fake' };
const CLAUDE = { proveedor: 'bedrock', modelo: 'us.anthropic.claude-sonnet-5-5' };

const conBytes = (m: MensajeCaptura, archivoBytes: number) =>
  ({ ...m, archivoBytes }) as MensajeCaptura;

describe('declararProcesamiento', () => {
  it('audio transcrito y clasificación fake: simulado, con la entrada en S3', () => {
    const mensaje = conBytes(mensajeArchivo('audio', 'capturas/x.webm', 'audio/webm'), 48_213);
    const p = declararProcesamiento(mensaje, { texto: 'Dijo agua.', via: 'transcribe' }, FAKE);
    expect(p).toEqual({
      simulado: true,
      entrada: {
        formato: 'audio',
        tipoArchivo: 'audio/webm',
        bytes: 48_213,
        claveS3: 'capturas/x.webm',
      },
      pasos: [
        { paso: 'transcripcion', estado: 'completado', detalle: expect.any(String) },
        { paso: 'extraccion', estado: 'simulado', detalle: expect.stringContaining('fake') },
      ],
    });
  });

  it('foto leída con Textract: el paso de lectura es real', () => {
    const mensaje = mensajeArchivo('foto', 'capturas/y.jpg', 'image/jpeg');
    const p = declararProcesamiento(
      mensaje,
      { texto: 'Apiló bloques.', via: 'lector_imagen', lector: 'textract' },
      FAKE,
    );
    expect(p.pasos[0]).toMatchObject({ paso: 'lectura_imagen', estado: 'completado' });
    expect(p.pasos[0]!.detalle).toContain('Textract');
    // Sin bytes en el mensaje (mensajes anteriores a este campo), se declara 0.
    expect(p.entrada.bytes).toBe(0);
  });

  it('foto con el lector fake: lectura simulada', () => {
    const mensaje = mensajeArchivo('foto', 'capturas/y.jpg', 'image/jpeg');
    const p = declararProcesamiento(
      mensaje,
      { texto: 'Texto de ejemplo.', via: 'lector_imagen', lector: 'fake' },
      CLAUDE,
    );
    expect(p.simulado).toBe(true);
    expect(p.pasos[0]).toMatchObject({ paso: 'lectura_imagen', estado: 'simulado' });
  });

  it('texto clasificado con Claude: completado, sin aviso de simulación', () => {
    const p = declararProcesamiento(
      mensajeTexto('Saltó en la rampa.'),
      { texto: 'Saltó en la rampa.', via: 'escrito' },
      CLAUDE,
    );
    expect(p).toEqual({
      simulado: false,
      entrada: { formato: 'texto', tipoArchivo: null, bytes: 19, claveS3: null },
      pasos: [
        {
          paso: 'extraccion',
          estado: 'completado',
          detalle: 'Clasificada con us.anthropic.claude-sonnet-5-5.',
        },
      ],
    });
  });
});
