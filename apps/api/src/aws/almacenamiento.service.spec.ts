import { ServiceUnavailableException } from '@nestjs/common';
import { HeadBucketCommand, HeadObjectCommand, NotFound, S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env';
import { AlmacenamientoService } from './almacenamiento.service';

describe('AlmacenamientoService.comprobarBucket', () => {
  const send = jest.spyOn(S3Client.prototype, 'send');

  afterEach(() => send.mockReset());
  afterAll(() => send.mockRestore());

  const servicio = (bucket?: string) =>
    new AlmacenamientoService({ AWS_REGION: 'us-east-1', S3_BUCKET_CAPTURAS: bucket } as Env);

  it('consulta el bucket configurado con HeadBucket', async () => {
    send.mockResolvedValueOnce({} as never);
    const senal = new AbortController().signal;
    await servicio('toqui-dev-capturas-111111111111').comprobarBucket(senal);
    const [comando, opciones] = send.mock.calls[0]!;
    expect(comando).toBeInstanceOf(HeadBucketCommand);
    expect(comando.input).toEqual({ Bucket: 'toqui-dev-capturas-111111111111' });
    expect(opciones).toEqual({ abortSignal: senal });
  });

  it('propaga el error de S3 (credenciales, permisos o bucket inexistente)', async () => {
    send.mockRejectedValueOnce(new Error('Forbidden') as never);
    await expect(servicio('otro-bucket').comprobarBucket()).rejects.toThrow('Forbidden');
  });

  it('falla sin llamar a S3 si no hay bucket configurado', async () => {
    await expect(servicio().comprobarBucket()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('AlmacenamientoService.describirArchivo', () => {
  // Espía propio: el del bloque anterior se restaura en su afterAll.
  let send: jest.SpiedFunction<S3Client['send']>;

  beforeAll(() => {
    send = jest.spyOn(S3Client.prototype, 'send');
  });
  afterEach(() => send.mockReset());
  afterAll(() => send.mockRestore());

  const servicio = new AlmacenamientoService({
    AWS_REGION: 'us-east-1',
    S3_BUCKET_CAPTURAS: 'toqui-dev-capturas-111111111111',
  } as Env);

  it('devuelve el tipo y el tamaño del objeto', async () => {
    send.mockResolvedValueOnce({ ContentType: 'audio/webm', ContentLength: 50_000 } as never);
    await expect(servicio.describirArchivo('capturas/x.webm')).resolves.toEqual({
      tipo: 'audio/webm',
      tamano: 50_000,
    });
    const [comando] = send.mock.calls[0]!;
    expect(comando).toBeInstanceOf(HeadObjectCommand);
    expect(comando.input).toEqual({
      Bucket: 'toqui-dev-capturas-111111111111',
      Key: 'capturas/x.webm',
    });
  });

  it('null si el archivo todavía no existe', async () => {
    send.mockRejectedValueOnce(new NotFound({ message: 'NotFound', $metadata: {} }) as never);
    await expect(servicio.describirArchivo('capturas/y.webm')).resolves.toBeNull();
  });

  it('propaga otros errores de S3', async () => {
    send.mockRejectedValueOnce(new Error('Forbidden') as never);
    await expect(servicio.describirArchivo('capturas/z.webm')).rejects.toThrow('Forbidden');
  });
});
