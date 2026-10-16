import { ThrottlingException } from '@aws-sdk/client-bedrock-runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clasificarConClaude, type EntradaClaude } from './clasificador.js';
import { ErrorIa } from './errores.js';
import { HERRAMIENTA_BORRADOR, mensajeClasificacion, sistemaClasificacion } from './prompt.js';
import {
  crearClienteSimulado,
  respuestaHerramienta,
  respuestaTexto,
} from './pruebas/bedrock-simulado.js';
import {
  catalogoDataset,
  catalogoOchoPorDiez,
  contextoNivel7,
  NUCLEOS_INVENTADOS,
} from './pruebas/catalogos.js';

const MODELO = 'modelo-de-prueba';
const TEXTO = 'Apiló cuatro bloques solo.';

function entrada(cambios: Partial<EntradaClaude> = {}): EntradaClaude {
  return { textoFuente: TEXTO, ...contextoNivel7(), ...cambios };
}

function textoEnviado(simulado: ReturnType<typeof crearClienteSimulado>, i = 0): string {
  return JSON.stringify(simulado.comandosConverse()[i]?.input);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('clasificarConClaude: salida normalizada', () => {
  it('con la herramienta devuelve nivelSugerido 7 y la manifestación, sin el campo nivel', async () => {
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
        }),
      ],
    });
    const salida = await clasificarConClaude(simulado.cliente, MODELO, entrada());
    expect(salida).toEqual({
      evidenciaInsuficiente: false,
      nivelSugerido: 7,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
    });
    expect(salida).not.toHaveProperty('nivel');
  });

  it('sin bloque toolUse devuelve un objeto vacío', async () => {
    const simulado = crearClienteSimulado({
      converse: [respuestaTexto('Creo que corresponde al nivel 7.')],
    });
    expect(await clasificarConClaude(simulado.cliente, MODELO, entrada())).toEqual({});
  });

  it('con un input de la herramienta que no es objeto devuelve un objeto vacío', async () => {
    for (const input of ['nivel 7', null, [{ nivel: 7 }], 7]) {
      const simulado = crearClienteSimulado({ converse: [respuestaHerramienta(input)] });
      expect(await clasificarConClaude(simulado.cliente, MODELO, entrada())).toEqual({});
    }
  });

  it('ignora el bloque toolUse de otra herramienta', async () => {
    const otra = respuestaHerramienta({ evidenciaInsuficiente: true });
    const bloque = otra.output?.message?.content?.[0];
    if (bloque?.toolUse) bloque.toolUse.name = 'otra_herramienta';
    const simulado = crearClienteSimulado({ converse: [otra] });
    expect(await clasificarConClaude(simulado.cliente, MODELO, entrada())).toEqual({});
  });

  it('con evidencia insuficiente elimina el nivel y las manifestaciones que sobran', async () => {
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: true,
          nivel: 5,
          manifestaciones: [{ idManifestacion: 'MAN-L05-MF-01', cita: 'Apiló' }],
        }),
      ],
    });
    expect(await clasificarConClaude(simulado.cliente, MODELO, entrada())).toEqual({
      evidenciaInsuficiente: true,
      nivelSugerido: null,
      manifestaciones: [],
    });
  });

  it('devuelve la cita como el fragmento literal aunque cambien mayúsculas y espacios', async () => {
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [
            { idManifestacion: 'MAN-L07-MF-01', cita: 'apiló  cuatro bloques' },
            { idManifestacion: 'MAN-L07-MF-02', cita: '«cuatro bloques solo.»' },
          ],
        }),
      ],
    });
    const salida = (await clasificarConClaude(simulado.cliente, MODELO, entrada())) as {
      manifestaciones: { idManifestacion: string; cita: string }[];
    };
    expect(salida.manifestaciones).toEqual([
      { idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' },
      { idManifestacion: 'MAN-L07-MF-02', cita: 'cuatro bloques solo' },
    ]);
    for (const { cita } of salida.manifestaciones) expect(TEXTO.includes(cita)).toBe(true);
  });

  it('conserva sin cambios una cita que no está en el texto', async () => {
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Encajó piezas grandes' }],
        }),
      ],
    });
    expect(await clasificarConClaude(simulado.cliente, MODELO, entrada())).toEqual({
      evidenciaInsuficiente: false,
      nivelSugerido: 7,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Encajó piezas grandes' }],
    });
  });

  it('no inventa evidenciaInsuficiente ni nivelSugerido si el modelo los omite', async () => {
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({
          manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
        }),
      ],
    });
    const salida = await clasificarConClaude(simulado.cliente, MODELO, entrada());
    expect(salida).toEqual({
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
    });
    expect(salida).not.toHaveProperty('evidenciaInsuficiente');
    expect(salida).not.toHaveProperty('nivelSugerido');
  });

  it('si trae nivel y nivelSugerido conserva nivelSugerido y elimina nivel', async () => {
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({ evidenciaInsuficiente: false, nivel: 6, nivelSugerido: 7 }),
      ],
    });
    expect(await clasificarConClaude(simulado.cliente, MODELO, entrada())).toEqual({
      evidenciaInsuficiente: false,
      nivelSugerido: 7,
    });
  });
});

describe('clasificarConClaude: llamada a Converse', () => {
  it('hace un solo send aunque la respuesta sea inválida', async () => {
    const simulado = crearClienteSimulado({
      converse: [respuestaHerramienta({ nivel: 'siete', manifestaciones: 'ninguna' })],
    });
    const salida = await clasificarConClaude(simulado.cliente, MODELO, entrada());
    expect(salida).toEqual({ nivelSugerido: 'siete', manifestaciones: 'ninguna' });
    expect(simulado.send).toHaveBeenCalledTimes(1);
  });

  it('envía el modelo, un mensaje de usuario, registrar_borrador, toolChoice auto y 1500 tokens', async () => {
    const simulado = crearClienteSimulado({ converse: [respuestaTexto('sin herramienta')] });
    const datos = entrada({ correccion: ['falta el nivel sugerido'] });
    await clasificarConClaude(simulado.cliente, MODELO, datos);
    const input = simulado.comandosConverse()[0]?.input;
    expect(Object.keys(input ?? {}).sort()).toEqual([
      'inferenceConfig',
      'messages',
      'modelId',
      'system',
      'toolConfig',
    ]);
    expect(input?.modelId).toBe(MODELO);
    expect(input?.system).toEqual([{ text: sistemaClasificacion(datos) }]);
    expect(input?.messages).toEqual([
      { role: 'user', content: [{ text: mensajeClasificacion(datos) }] },
    ]);
    expect(input?.toolConfig).toEqual({
      tools: [{ toolSpec: HERRAMIENTA_BORRADOR }],
      toolChoice: { auto: {} },
    });
    expect(input?.toolConfig?.tools?.[0]?.toolSpec?.name).toBe('registrar_borrador');
    expect(input?.inferenceConfig).toEqual({ maxTokens: 1500 });
  });

  it('envía una abortSignal de 60 000 ms por defecto como segundo argumento de send', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const simulado = crearClienteSimulado({ converse: [respuestaTexto('sin herramienta')] });
    await clasificarConClaude(simulado.cliente, MODELO, entrada());
    expect(timeout).toHaveBeenCalledWith(60_000);
    const [, opciones] = (simulado.send.mock.calls[0] ?? []) as unknown[];
    const { abortSignal } = opciones as { abortSignal?: AbortSignal };
    expect(abortSignal).toBeInstanceOf(AbortSignal);
    expect(abortSignal).toBe(timeout.mock.results[0]?.value);
  });

  it('respeta tiempoMaximoMs y propaga el error cuando la señal cancela la llamada', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    // Como el SDK: la llamada queda pendiente hasta que la señal la cancela.
    const send = vi.fn((_comando: unknown, opciones?: { abortSignal?: AbortSignal }) => {
      const senal = opciones?.abortSignal;
      return new Promise((_resolver, rechazar) => {
        senal?.addEventListener('abort', () => rechazar(senal.reason));
      });
    });
    const error = await clasificarConClaude({ send } as never, MODELO, entrada(), {
      tiempoMaximoMs: 20,
    }).catch((e: unknown) => e);
    expect(timeout).toHaveBeenCalledWith(20);
    expect((error as Error).name).toBe('TimeoutError');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('propaga ThrottlingException sin envolver, con su nombre original', async () => {
    const error = new ThrottlingException({ message: 'Rate exceeded (simulado)', $metadata: {} });
    const simulado = crearClienteSimulado({ converse: [error] });
    const rechazo = await clasificarConClaude(simulado.cliente, MODELO, entrada()).catch(
      (e: unknown) => e,
    );
    expect(rechazo).toBe(error);
    expect((rechazo as Error).name).toBe('ThrottlingException');
    expect(rechazo).not.toBeInstanceOf(ErrorIa);
    expect(simulado.send).toHaveBeenCalledTimes(1);
  });

  it('la solicitud no contiene idCaptura, idJardin ni idUsuario aunque vengan en la entrada', async () => {
    const simulado = crearClienteSimulado({ converse: [respuestaTexto('sin herramienta')] });
    const conIds = {
      ...entrada({ conocimiento: ['Fragmento ficticio'], correccion: ['falta el nivel sugerido'] }),
      idCaptura: 'CAPTURA-FICTICIA-001',
      idJardin: 'JARDIN-FICTICIO-001',
      idUsuario: 'USUARIO-FICTICIO-001',
    } as EntradaClaude;
    await clasificarConClaude(simulado.cliente, MODELO, conIds);
    const enviado = textoEnviado(simulado);
    expect(enviado).toContain('Apiló cuatro bloques solo.');
    for (const prohibido of [
      'idCaptura',
      'idJardin',
      'idUsuario',
      'CAPTURA-FICTICIA-001',
      'JARDIN-FICTICIO-001',
      'USUARIO-FICTICIO-001',
    ]) {
      expect(enviado).not.toContain(prohibido);
    }
  });
});

describe('clasificarConClaude: catálogos parametrizables', () => {
  it('de punta a punta con la rúbrica tipo dataset (8 niveles × 5 núcleos)', async () => {
    const catalogo = catalogoDataset();
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'APILÓ cuatro bloques' }],
        }),
      ],
    });
    const salida = await clasificarConClaude(
      simulado.cliente,
      MODELO,
      entrada({ edadMeses: 30, nivelEsperado: 7, catalogo }),
    );
    expect(salida).toEqual({
      evidenciaInsuficiente: false,
      nivelSugerido: 7,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques' }],
    });
    const mensaje = simulado.comandosConverse()[0]?.input.messages?.[0]?.content?.[0]?.text ?? '';
    const niveles = [...mensaje.matchAll(/^Nivel (\d+):$/gm)].map((m) => Number(m[1]));
    expect(niveles).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(mensaje.match(/^- MAN-L\d\d-/gm)).toHaveLength(catalogo.length);
  });

  it('de punta a punta con una rúbrica inventada de 8 niveles × 10 núcleos', async () => {
    const texto = 'Ordenó piezas de colores según el tamaño de cada una.';
    const simulado = crearClienteSimulado({
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 3,
          manifestaciones: [{ idManifestacion: 'RUB-N3-05', cita: 'ordenó piezas de colores' }],
        }),
      ],
    });
    const salida = await clasificarConClaude(simulado.cliente, MODELO, {
      textoFuente: texto,
      edadMeses: 20,
      nivelEsperado: 3,
      catalogo: catalogoOchoPorDiez(),
    });
    expect(salida).toEqual({
      evidenciaInsuficiente: false,
      nivelSugerido: 3,
      manifestaciones: [{ idManifestacion: 'RUB-N3-05', cita: 'Ordenó piezas de colores' }],
    });
    const mensaje = simulado.comandosConverse()[0]?.input.messages?.[0]?.content?.[0]?.text ?? '';
    for (const nucleo of NUCLEOS_INVENTADOS) expect(mensaje).toContain(`[${nucleo}]`);
    const niveles = [...mensaje.matchAll(/^Nivel (\d+):$/gm)].map((m) => Number(m[1]));
    expect(niveles).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
