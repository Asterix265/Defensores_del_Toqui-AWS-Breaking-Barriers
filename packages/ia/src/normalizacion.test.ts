import { describe, expect, it } from 'vitest';
import { normalizarTexto, textoDeTranscripcion } from './normalizacion.js';

describe('normalizarTexto', () => {
  it('recorta y colapsa espacios y saltos repetidos', () => {
    expect(normalizarTexto('  Apiló   cuatro\n\nbloques.  ')).toBe('Apiló cuatro bloques.');
  });

  it('conserva mayúsculas y puntuación', () => {
    expect(normalizarTexto('¡Dijo «MAMÁ»!\t¿Otra vez?')).toBe('¡Dijo «MAMÁ»! ¿Otra vez?');
  });

  it('normaliza a NFC', () => {
    const descompuesto = 'Apilo\u0301 bloques';
    expect(descompuesto).not.toBe('Apiló bloques');
    expect(normalizarTexto(descompuesto)).toBe('Apiló bloques');
  });

  it('devuelve cadena vacía si solo hay espacios', () => {
    expect(normalizarTexto(' \n\t ')).toBe('');
  });
});

describe('textoDeTranscripcion', () => {
  it('extrae y recorta la transcripción', () => {
    const json = JSON.stringify({ results: { transcripts: [{ transcript: ' Apiló bloques. ' }] } });
    expect(textoDeTranscripcion(json)).toBe('Apiló bloques.');
  });

  it('une varias transcripciones con espacio', () => {
    const json = JSON.stringify({
      results: { transcripts: [{ transcript: 'Apiló bloques.' }, { transcript: 'Aplaudió.' }] },
    });
    expect(textoDeTranscripcion(json)).toBe('Apiló bloques. Aplaudió.');
  });

  it('devuelve cadena vacía sin transcripciones', () => {
    expect(textoDeTranscripcion(JSON.stringify({ results: { transcripts: [] } }))).toBe('');
    expect(textoDeTranscripcion(JSON.stringify({ jobName: 'ficticio' }))).toBe('');
    expect(textoDeTranscripcion('null')).toBe('');
  });

  it('lanza un error claro si el JSON es inválido', () => {
    expect(() => textoDeTranscripcion('{no es json')).toThrow(
      'El resultado de Transcribe no es un JSON válido.',
    );
  });
});
