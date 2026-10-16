import { describe, expect, it } from 'vitest';
import { formatoBytes, prepararFoto, tipoBase } from './captura';

describe('tipoBase', () => {
  it('quita los parámetros del tipo, como exige la firma de S3', () => {
    expect(tipoBase('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(tipoBase('Image/JPEG')).toBe('image/jpeg');
  });
});

describe('formatoBytes', () => {
  it('muestra bytes, KB o MB', () => {
    expect(formatoBytes(5)).toBe('5 B');
    expect(formatoBytes(48_213)).toBe('47 KB');
    expect(formatoBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('prepararFoto', () => {
  it('deja tal cual un JPEG o PNG de hasta 10 MB', async () => {
    const foto = new File(['x'], 'postit.png', { type: 'image/png' });
    await expect(prepararFoto(foto)).resolves.toBe(foto);
  });

  it('avisa si no puede leer una imagen en otro formato', async () => {
    const heic = new File(['x'], 'postit.heic', { type: 'image/heic' });
    await expect(prepararFoto(heic)).rejects.toThrow('No se pudo leer esa imagen');
  });
});
