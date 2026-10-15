import type { SQSEvent } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { ErrorCapturaCerrada, ErrorPermanente } from '../errores.js';
import type { Clasificador, Dependencias } from '../puertos.js';
import {
  CATALOGO,
  depsFalsas,
  ID_CAPTURA,
  mensajeArchivo,
  mensajeTexto,
} from '../pruebas/datos.js';
import { crearHandler } from './proceso.js';

const silencio = () => undefined;

function evento(cuerpo: unknown, intento = 1): SQSEvent {
  return {
    Records: [
      {
        messageId: 'msg-1',
        body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
        attributes: { ApproximateReceiveCount: String(intento) },
      },
    ],
  } as unknown as SQSEvent;
}

function ejecutar(deps: Dependencias, cuerpo: unknown, intento = 1) {
  const handler = crearHandler(() => ({ deps, maxIntentos: 3 }), silencio);
  return handler(evento(cuerpo, intento));
}

describe('handler proceso', () => {
  it('nota de texto: anonimiza, clasifica, entrega y avisa', async () => {
    const deps = depsFalsas({
      anonimizador: { anonimizar: vi.fn(async (t: string) => t.replace('Apiló', 'Apiló')) },
    });
    const r = await ejecutar(deps, mensajeTexto());

    expect(r.batchItemFailures).toEqual([]);
    expect(deps.anonimizador.anonimizar).toHaveBeenCalledWith(
      'Apiló cinco bloques sin ayuda y sonrió.',
    );
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(ID_CAPTURA, {
      textoFuente: 'Apiló cinco bloques sin ayuda y sonrió.',
      nivelSugerido: 4,
      evidenciaInsuficiente: false,
      manifestaciones: [
        { idManifestacion: 'M-4-MF-1', cita: 'Apiló cinco bloques sin ayuda y sonrió.' },
      ],
      proveedor: 'fake',
    });
    expect(deps.avisador.avisar).toHaveBeenCalledWith('sub-educadora-1', {
      idCaptura: ID_CAPTURA,
      estado: 'borrador_listo',
    });
  });

  it('audio: transcribe antes de clasificar', async () => {
    const deps = depsFalsas();
    await ejecutar(deps, mensajeArchivo('audio', `capturas/${ID_CAPTURA}.webm`, 'audio/webm'));
    expect(deps.transcriptor.transcribir).toHaveBeenCalledWith({
      idCaptura: ID_CAPTURA,
      clave: `capturas/${ID_CAPTURA}.webm`,
      tipo: 'audio/webm',
    });
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(
      ID_CAPTURA,
      expect.objectContaining({ textoFuente: 'Dijo agua cuando tuvo sed.' }),
    );
  });

  it('foto: el lector recibe la clave en S3 y su texto se clasifica', async () => {
    const deps = depsFalsas();
    await ejecutar(deps, mensajeArchivo('foto', `capturas/${ID_CAPTURA}.jpg`, 'image/jpeg'));
    expect(deps.lectorImagen.leer).toHaveBeenCalledWith({
      idCaptura: ID_CAPTURA,
      clave: `capturas/${ID_CAPTURA}.jpg`,
      tipo: 'image/jpeg',
    });
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(
      ID_CAPTURA,
      expect.objectContaining({ textoFuente: 'Apiló cuatro bloques solo.' }),
    );
  });

  it('foto sin texto legible: error permanente', async () => {
    const deps = depsFalsas({
      lectorImagen: { proveedor: 'prueba', leer: vi.fn(async () => '  ') },
    });
    const r = await ejecutar(deps, mensajeArchivo('foto', 'capturas/x.png', 'image/png'));
    expect(r.batchItemFailures).toEqual([]);
    expect(deps.api.informarError).toHaveBeenCalledWith(
      ID_CAPTURA,
      'No se pudo leer texto en la foto',
    );
  });

  it('reintenta una vez con la corrección y luego entrega evidencia insuficiente', async () => {
    const clasificar = vi.fn<Clasificador['clasificar']>(async () => ({
      nivelSugerido: 4,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'M-4-MF-1', cita: 'texto inventado' }],
    }));
    const deps = depsFalsas({ clasificador: { proveedor: 'prueba', clasificar } });
    await ejecutar(deps, mensajeTexto());

    expect(clasificar).toHaveBeenCalledTimes(2);
    expect(clasificar.mock.calls[1]![0]).toMatchObject({
      correccion: ['la cita de M-4-MF-1 no aparece literalmente en el texto'],
      catalogo: CATALOGO,
    });
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(
      ID_CAPTURA,
      expect.objectContaining({
        evidenciaInsuficiente: true,
        manifestaciones: [],
        proveedor: 'prueba',
      }),
    );
  });

  it('error transitorio antes del último intento: vuelve a la cola sin informar', async () => {
    const deps = depsFalsas({
      clasificador: {
        proveedor: 'prueba',
        clasificar: vi.fn().mockRejectedValue(new Error('Throttling')),
      },
    });
    const r = await ejecutar(deps, mensajeTexto(), 1);
    expect(r.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
    expect(deps.api.informarError).not.toHaveBeenCalled();
  });

  it('error transitorio en el último intento: informa el error y avisa', async () => {
    const deps = depsFalsas({
      clasificador: {
        proveedor: 'prueba',
        clasificar: vi.fn().mockRejectedValue(new Error('Throttling')),
      },
    });
    const r = await ejecutar(deps, mensajeTexto(), 3);
    expect(r.batchItemFailures).toEqual([]);
    expect(deps.api.informarError).toHaveBeenCalledWith(ID_CAPTURA, expect.any(String));
    expect(deps.avisador.avisar).toHaveBeenCalledWith('sub-educadora-1', {
      idCaptura: ID_CAPTURA,
      estado: 'error',
    });
  });

  it('error permanente: informa de inmediato con el detalle', async () => {
    const deps = depsFalsas({
      transcriptor: {
        transcribir: vi
          .fn()
          .mockRejectedValue(new ErrorPermanente('No se pudo transcribir el audio')),
      },
    });
    const r = await ejecutar(deps, mensajeArchivo('audio', 'capturas/x.wav', 'audio/wav'));
    expect(r.batchItemFailures).toEqual([]);
    expect(deps.api.informarError).toHaveBeenCalledWith(
      ID_CAPTURA,
      'No se pudo transcribir el audio',
    );
  });

  it('si no logra informar el error en el último intento, el mensaje va a la DLQ', async () => {
    const deps = depsFalsas({
      clasificador: { proveedor: 'prueba', clasificar: vi.fn().mockRejectedValue(new Error('x')) },
      api: {
        entregarBorrador: vi.fn(),
        informarError: vi.fn().mockRejectedValue(new Error('API caída')),
      },
    });
    const r = await ejecutar(deps, mensajeTexto(), 3);
    expect(r.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
  });

  it('captura ya confirmada: descarta el trabajo sin error', async () => {
    const deps = depsFalsas({
      api: {
        entregarBorrador: vi.fn().mockRejectedValue(new ErrorCapturaCerrada(409)),
        informarError: vi.fn(),
      },
    });
    const r = await ejecutar(deps, mensajeTexto());
    expect(r.batchItemFailures).toEqual([]);
    expect(deps.api.informarError).not.toHaveBeenCalled();
    expect(deps.avisador.avisar).not.toHaveBeenCalled();
  });

  it('un aviso fallido no hace fallar el trabajo', async () => {
    const deps = depsFalsas({
      avisador: { avisar: vi.fn().mockRejectedValue(new Error('AppSync')) },
    });
    const r = await ejecutar(deps, mensajeTexto());
    expect(r.batchItemFailures).toEqual([]);
  });

  it('memoria o conocimiento caídos: clasifica igual', async () => {
    const deps = depsFalsas({
      contexto: { recuperar: vi.fn().mockRejectedValue(new Error('S3 Vectors')) },
    });
    const r = await ejecutar(deps, mensajeTexto());
    expect(r.batchItemFailures).toEqual([]);
    expect(deps.api.entregarBorrador).toHaveBeenCalled();
  });

  it('mensaje inválido con id: informa el error y lo saca de la cola', async () => {
    const deps = depsFalsas();
    const r = await ejecutar(deps, { idCaptura: ID_CAPTURA, formato: 'texto' });
    expect(r.batchItemFailures).toEqual([]);
    expect(deps.api.informarError).toHaveBeenCalledWith(ID_CAPTURA, 'El trabajo llegó incompleto');
  });

  it('mensaje ilegible sin id: lo deja para la DLQ', async () => {
    const r = await ejecutar(depsFalsas(), 'no es json');
    expect(r.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
  });
});
