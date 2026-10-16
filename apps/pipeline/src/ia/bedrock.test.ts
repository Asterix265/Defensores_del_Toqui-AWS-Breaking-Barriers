import {
  ConverseCommand,
  ThrottlingException,
  type BedrockRuntimeClient,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type { SQSEvent } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { crearHandler } from '../handlers/proceso.js';
import { procesarCaptura } from '../orquestador.js';
import type { EntradaClasificacion } from '../puertos.js';
import { CATALOGO, depsFalsas, ID_CAPTURA, mensajeTexto } from '../pruebas/datos.js';
import type { Log } from '../registro-log.js';
import { validarClasificacion } from '../validacion.js';
import { ClasificadorBedrock, TIEMPO_MAXIMO_CLAUDE_MS } from './bedrock.js';

const MODELO = 'modelo-prueba';
/** Texto de `mensajeTexto()`; el anonimizador de `depsFalsas` lo devuelve sin cambios. */
const TEXTO = 'Apiló cinco bloques sin ayuda y sonrió.';

function converse(content: unknown[]): ConverseCommandOutput {
  return {
    $metadata: {},
    output: { message: { role: 'assistant', content } },
    stopReason: 'end_turn',
  } as ConverseCommandOutput;
}

/** Respuesta del modelo con la herramienta `registrar_borrador`. */
const herramienta = (input: unknown) =>
  converse([{ toolUse: { toolUseId: 'uso-1', name: 'registrar_borrador', input } }]);

/** Respuesta del modelo solo con texto. */
const soloTexto = (texto: string) => converse([{ text: texto }]);

const valida = () =>
  herramienta({
    evidenciaInsuficiente: false,
    nivel: 4,
    manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Apiló cinco bloques sin ayuda' }],
  });

const idInventado = () =>
  herramienta({
    evidenciaInsuficiente: false,
    nivel: 4,
    manifestaciones: [{ idManifestacion: 'M-4-XX-9', cita: 'Apiló cinco bloques' }],
  });

/** Cliente de Bedrock simulado, sin red ni credenciales: responde en orden o lanza el Error. */
function clienteSimulado(...respuestas: (ConverseCommandOutput | Error)[]) {
  const cola = [...respuestas];
  const send = vi.fn(async (comando: unknown) => {
    if (!(comando instanceof ConverseCommand)) throw new Error('comando no simulado');
    const siguiente = cola.shift();
    if (!siguiente) throw new Error('no quedan respuestas simuladas');
    if (siguiente instanceof Error) throw siguiente;
    return siguiente;
  });
  return {
    cliente: { send } as unknown as Pick<BedrockRuntimeClient, 'send'>,
    send,
    comandos: () => send.mock.calls.map(([comando]) => comando as ConverseCommand),
  };
}

function mensajeUsuario(comando: ConverseCommand | undefined): string {
  return comando?.input.messages?.[0]?.content?.[0]?.text ?? '';
}

function entradaPuerto(cambios: Partial<EntradaClasificacion> = {}): EntradaClasificacion {
  return {
    textoFuente: TEXTO,
    edadMeses: 20,
    nivelEsperado: 4,
    catalogo: CATALOGO,
    contexto: { conocimiento: [], ejemplos: [] },
    ...cambios,
  };
}

function conBedrock(simulado: ReturnType<typeof clienteSimulado>) {
  return depsFalsas({ clasificador: new ClasificadorBedrock(simulado.cliente, MODELO) });
}

describe('ClasificadorBedrock', () => {
  it('declara el proveedor bedrock y el modelo recibido', () => {
    const clasificador = new ClasificadorBedrock(clienteSimulado().cliente, MODELO);
    expect(clasificador.proveedor).toBe('bedrock');
    expect(clasificador.modelo).toBe(MODELO);
  });

  it('limita cada llamada a Claude a 40 s, para que el peor caso de audio quepa en la Lambda', async () => {
    expect(TIEMPO_MAXIMO_CLAUDE_MS).toBe(40_000);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const simulado = clienteSimulado(valida());
    await new ClasificadorBedrock(simulado.cliente, MODELO).clasificar(entradaPuerto());
    expect(timeout).toHaveBeenCalledWith(40_000);
    expect((simulado.send.mock.calls[0] as unknown[] | undefined)?.[1]).toMatchObject({
      abortSignal: expect.any(AbortSignal),
    });
    timeout.mockRestore();
  });

  it('pasa al modelo el texto, la edad, el nivel, el catálogo, el contexto y la corrección', async () => {
    const simulado = clienteSimulado(valida());
    await new ClasificadorBedrock(simulado.cliente, MODELO).clasificar(
      entradaPuerto({
        contexto: {
          conocimiento: ['Fragmento ficticio de conocimiento sobre el nivel 4.'],
          ejemplos: [
            {
              textoFuente: 'Caso ficticio: apiló tres bloques.',
              nivel: 4,
              idsManifestaciones: ['M-4-CM-1'],
            },
          ],
        },
        correccion: ['M-4-XX-9 no está en el catálogo permitido'],
      }),
    );
    const comando = simulado.comandos()[0];
    expect(comando?.input.modelId).toBe(MODELO);
    const mensaje = mensajeUsuario(comando);
    for (const parte of [
      'Edad: 20 meses',
      'Nivel de referencia (último validado): 4',
      '- M-4-CM-1 [CM] Apila 3 o más bloques',
      '- M-4-LV-1 [LV] Dice palabras',
      '- M-5-CM-1 [CM] Encaja piezas',
      '- Fragmento ficticio de conocimiento sobre el nivel 4.',
      '- Nota: «Caso ficticio: apiló tres bloques.» → nivel 4, manifestaciones M-4-CM-1',
      '- M-4-XX-9 no está en el catálogo permitido',
      `<nota>\n${TEXTO}\n</nota>`,
    ]) {
      expect(mensaje).toContain(parte);
    }
    const sistema = comando?.input.system?.[0]?.text ?? '';
    expect(sistema).toContain('nunca como fuente de citas');
    expect(sistema).toContain('Recibes casos parecidos');
    expect(sistema).toContain('Tu intento anterior no fue válido');
  });

  it('una cita que no está en el texto llega sin cambios y la validación nombra la manifestación', async () => {
    const simulado = clienteSimulado(
      herramienta({
        evidenciaInsuficiente: false,
        nivel: 4,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Encajó piezas grandes' }],
      }),
    );
    const salida = await new ClasificadorBedrock(simulado.cliente, MODELO).clasificar(
      entradaPuerto(),
    );
    expect(salida).toMatchObject({
      manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Encajó piezas grandes' }],
    });
    expect(validarClasificacion(salida, TEXTO, CATALOGO)).toEqual({
      ok: false,
      problemas: ['la cita de M-4-CM-1 no aparece literalmente en el texto'],
    });
  });

  it('si el modelo omite evidenciaInsuficiente, la validación reporta el campo faltante', async () => {
    const simulado = clienteSimulado(
      herramienta({
        nivel: 4,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Apiló cinco bloques' }],
      }),
    );
    const salida = await new ClasificadorBedrock(simulado.cliente, MODELO).clasificar(
      entradaPuerto(),
    );
    expect(salida).not.toHaveProperty('evidenciaInsuficiente');
    const validacion = validarClasificacion(salida, TEXTO, CATALOGO);
    expect(validacion.ok).toBe(false);
    if (!validacion.ok) {
      expect(validacion.problemas.some((p) => p.startsWith('evidenciaInsuficiente:'))).toBe(true);
    }
  });
});

describe('ClasificadorBedrock en el orquestador', () => {
  it('entrega el borrador de Claude con proveedor, modelo, citas literales y extracción completada', async () => {
    const simulado = clienteSimulado(valida());
    const deps = conBedrock(simulado);
    await procesarCaptura(mensajeTexto(), deps, vi.fn());
    expect(simulado.send).toHaveBeenCalledTimes(1);
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(ID_CAPTURA, {
      textoFuente: TEXTO,
      nivelSugerido: 4,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Apiló cinco bloques sin ayuda' }],
      proveedor: 'bedrock',
      modelo: MODELO,
      procesamiento: {
        simulado: false,
        entrada: { formato: 'texto', tipoArchivo: null, bytes: 41, claveS3: null },
        pasos: [
          { paso: 'extraccion', estado: 'completado', detalle: 'Clasificada con modelo-prueba.' },
        ],
        ejemplosUsados: 0,
      },
    });
  });

  it('las decisiones previas del jardín llegan al prompt como casos parecidos', async () => {
    const simulado = clienteSimulado(valida());
    const deps = conBedrock(simulado);
    const ejemplo = {
      textoFuente: 'Apiló cuatro bloques con ayuda.',
      nivel: 3,
      idsManifestaciones: ['M-4-CM-1'],
      corregida: true,
    };
    await procesarCaptura({ ...mensajeTexto(), ejemplos: [ejemplo] }, deps, vi.fn());

    const [comando] = simulado.comandos();
    expect(mensajeUsuario(comando)).toContain('Casos parecidos de decisiones previas del jardín');
    expect(mensajeUsuario(comando)).toContain(
      '- Nota: «Apiló cuatro bloques con ayuda.» → nivel 3, manifestaciones M-4-CM-1',
    );
  });

  it('con un id inventado reintenta con el problema y entrega la segunda propuesta', async () => {
    const simulado = clienteSimulado(idInventado(), valida());
    const deps = conBedrock(simulado);
    const log = vi.fn<Log>();
    await procesarCaptura(mensajeTexto(), deps, log);

    const [primero, segundo] = simulado.comandos();
    expect(simulado.send).toHaveBeenCalledTimes(2);
    expect(mensajeUsuario(primero)).not.toContain('Tu intento anterior');
    expect(mensajeUsuario(segundo)).toContain(
      'Tu intento anterior no fue válido. Corrige estos problemas y vuelve a llamar a la herramienta registrar_borrador:\n- M-4-XX-9 no está en el catálogo permitido',
    );
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(
      ID_CAPTURA,
      expect.objectContaining({
        nivelSugerido: 4,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Apiló cinco bloques sin ayuda' }],
        proveedor: 'bedrock',
      }),
    );
    // El log registra el problema por id, nunca el texto de la nota ni las citas.
    const registrado = JSON.stringify(log.mock.calls);
    expect(registrado).toContain('M-4-XX-9');
    expect(registrado).not.toContain('Apiló');
    expect(registrado).not.toContain('bloques');
  });

  it('con dos respuestas inválidas entrega evidencia insuficiente con proveedor bedrock', async () => {
    const simulado = clienteSimulado(idInventado(), idInventado());
    const deps = conBedrock(simulado);
    await procesarCaptura(mensajeTexto(), deps, vi.fn());
    expect(simulado.send).toHaveBeenCalledTimes(2);
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(ID_CAPTURA, {
      textoFuente: TEXTO,
      nivelSugerido: null,
      evidenciaInsuficiente: true,
      manifestaciones: [],
      proveedor: 'bedrock',
      modelo: MODELO,
      procesamiento: expect.objectContaining({ simulado: false }),
    });
  });

  it('ThrottlingException: rechaza con ese error y no entrega borrador', async () => {
    const error = new ThrottlingException({ message: 'Rate exceeded (simulado)', $metadata: {} });
    const simulado = clienteSimulado(error);
    const deps = conBedrock(simulado);
    await expect(procesarCaptura(mensajeTexto(), deps, vi.fn())).rejects.toBe(error);
    expect(simulado.send).toHaveBeenCalledTimes(1);
    expect(deps.api.entregarBorrador).not.toHaveBeenCalled();
  });

  it('una respuesta sin herramienta se reintenta con corrección', async () => {
    const simulado = clienteSimulado(soloTexto('Creo que corresponde al nivel 4.'), valida());
    const deps = conBedrock(simulado);
    await procesarCaptura(mensajeTexto(), deps, vi.fn());
    expect(simulado.send).toHaveBeenCalledTimes(2);
    expect(mensajeUsuario(simulado.comandos()[1])).toContain('Tu intento anterior no fue válido');
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(
      ID_CAPTURA,
      expect.objectContaining({ evidenciaInsuficiente: false, nivelSugerido: 4 }),
    );
  });

  it('una cita con otra capitalización y espacios llega al borrador como el fragmento literal', async () => {
    const simulado = clienteSimulado(
      herramienta({
        evidenciaInsuficiente: false,
        nivel: 4,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'apiló  cinco BLOQUES' }],
      }),
    );
    const deps = conBedrock(simulado);
    await procesarCaptura(mensajeTexto(), deps, vi.fn());
    expect(simulado.send).toHaveBeenCalledTimes(1);
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(
      ID_CAPTURA,
      expect.objectContaining({
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: 'Apiló cinco bloques' }],
      }),
    );
  });

  it('ninguna solicitud lleva el id de la captura, del usuario ni del jardín', async () => {
    const simulado = clienteSimulado(idInventado(), valida());
    await procesarCaptura(mensajeTexto(), conBedrock(simulado), vi.fn());
    expect(simulado.comandos()).toHaveLength(2);
    for (const comando of simulado.comandos()) {
      const enviado = JSON.stringify(comando.input);
      for (const prohibido of [ID_CAPTURA, 'sub-educadora-1', 'J-001']) {
        expect(enviado).not.toContain(prohibido);
      }
    }
  });

  it('Claude recibe el texto anonimizado, que es el textoFuente del borrador', async () => {
    const anonimo = '{NAME} apiló cuatro bloques';
    const simulado = clienteSimulado(
      herramienta({
        evidenciaInsuficiente: false,
        nivel: 4,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: '{NAME} apiló cuatro bloques' }],
      }),
    );
    const deps = depsFalsas({
      anonimizador: { anonimizar: vi.fn(async () => anonimo) },
      clasificador: new ClasificadorBedrock(simulado.cliente, MODELO),
    });
    await procesarCaptura(mensajeTexto('Persona Ficticia Uno apiló cuatro bloques'), deps, vi.fn());
    const enviado = JSON.stringify(simulado.comandos()[0]?.input);
    expect(mensajeUsuario(simulado.comandos()[0])).toContain(`<nota>\n${anonimo}\n</nota>`);
    expect(enviado).not.toContain('Persona Ficticia');
    expect(deps.api.entregarBorrador).toHaveBeenCalledWith(
      ID_CAPTURA,
      expect.objectContaining({
        textoFuente: anonimo,
        manifestaciones: [{ idManifestacion: 'M-4-CM-1', cita: '{NAME} apiló cuatro bloques' }],
      }),
    );
  });
});

describe('ClasificadorBedrock en el handler proceso', () => {
  it('error transitorio antes del último intento: vuelve a la cola sin informar', async () => {
    const simulado = clienteSimulado(
      new ThrottlingException({ message: 'Rate exceeded (simulado)', $metadata: {} }),
    );
    const deps = conBedrock(simulado);
    const handler = crearHandler(() => ({ deps, maxIntentos: 3 }), vi.fn());
    const evento = {
      Records: [
        {
          messageId: 'msg-1',
          body: JSON.stringify(mensajeTexto()),
          attributes: { ApproximateReceiveCount: '1' },
        },
      ],
    } as unknown as SQSEvent;

    const r = await handler(evento);
    expect(r.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
    expect(deps.api.informarError).not.toHaveBeenCalled();
    expect(deps.api.entregarBorrador).not.toHaveBeenCalled();
    expect(deps.avisador.avisar).not.toHaveBeenCalled();
  });
});
