import { ThrottlingException, type ContentBlock } from '@aws-sdk/client-bedrock-runtime';
import { BorradorEntranteSchema, type BorradorEntrante } from '@toqui/shared';
import { describe, expect, it } from 'vitest';
import { ProveedorBedrock } from './bedrock.js';
import { ErrorIa } from './errores.js';
import { INSTRUCCION_FOTO, SISTEMA_EXTRACCION } from './prompt.js';
import {
  crearClienteSimulado,
  guardrailAnonimiza,
  guardrailBloquea,
  guardrailSinCambios,
  guardrailSinTexto,
  respuestaHerramienta,
  respuestaTexto,
  respuestaVacia,
} from './pruebas/bedrock-simulado.js';
import { catalogoOchoPorDiez, contextoNivel7, NUCLEOS_INVENTADOS } from './pruebas/catalogos.js';
import type { ContextoExtraccion, FormatoImagen } from './proveedor.js';

const MODELO = 'modelo-de-prueba';
const GUARDRAIL = { id: 'guardrail-ficticio', version: '1' };
const NOTA = 'Apiló cuatro bloques solo y aplaudió cuando no se cayeron.';

const valida = respuestaHerramienta({
  evidenciaInsuficiente: false,
  nivel: 7,
  manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques solo' }],
});

const inexistente = respuestaHerramienta(
  {
    evidenciaInsuficiente: false,
    nivel: 7,
    manifestaciones: [{ idManifestacion: 'MAN-L99-XX-01', cita: 'Apiló cuatro bloques' }],
  },
  'uso-inexistente',
);

const insuficiente = (textoFuente: string): BorradorEntrante => ({
  textoFuente,
  nivelSugerido: null,
  evidenciaInsuficiente: true,
  manifestaciones: [],
  proveedor: 'bedrock',
  modelo: MODELO,
});

function proveedor(simulado: ReturnType<typeof crearClienteSimulado>, conGuardrail = true) {
  return new ProveedorBedrock({
    cliente: simulado.cliente,
    modelo: MODELO,
    ...(conGuardrail ? { guardrail: GUARDRAIL } : {}),
  });
}

/** Lo que exige la API al recibir el borrador. */
function cumpleContrato(borrador: BorradorEntrante): BorradorEntrante {
  expect(() => BorradorEntranteSchema.parse(borrador)).not.toThrow();
  for (const m of borrador.manifestaciones) expect(borrador.textoFuente).toContain(m.cita);
  return borrador;
}

function textoEnviado(simulado: ReturnType<typeof crearClienteSimulado>, i = 0): string {
  return JSON.stringify(simulado.comandosConverse()[i]?.input);
}

describe('ProveedorBedrock.extraer', () => {
  it('extrae MAN-L07-MF-01 con una cita literal de la nota', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [valida],
    });
    const borrador = cumpleContrato(await proveedor(simulado).extraer(NOTA, contextoNivel7()));
    expect(borrador).toEqual({
      textoFuente: NOTA,
      nivelSugerido: 7,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques solo' }],
      proveedor: 'bedrock',
      modelo: MODELO,
    });
    expect(simulado.comandosGuardrail()).toHaveLength(1);
    expect(simulado.comandosConverse()).toHaveLength(1);
  });

  it('aplica el Guardrail antes de Claude con la nota original como entrada', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [valida],
    });
    await proveedor(simulado).extraer(`  ${NOTA}\n`, contextoNivel7());
    const [primero, segundo] = simulado.send.mock.calls.map(([c]) => c);
    expect(primero).toBe(simulado.comandosGuardrail()[0]);
    expect(segundo).toBe(simulado.comandosConverse()[0]);
    expect(simulado.comandosGuardrail()[0]?.input).toEqual({
      guardrailIdentifier: 'guardrail-ficticio',
      guardrailVersion: '1',
      source: 'INPUT',
      content: [{ text: { text: NOTA } }],
    });
  });

  it('configura Converse con sistema, herramienta registrar_borrador y toolChoice auto', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [valida],
    });
    await proveedor(simulado).extraer(NOTA, contextoNivel7());
    const input = simulado.comandosConverse()[0]?.input;
    expect(input?.modelId).toBe(MODELO);
    expect(input?.system).toEqual([{ text: SISTEMA_EXTRACCION }]);
    expect(input?.toolConfig?.toolChoice).toEqual({ auto: {} });
    expect(input?.toolConfig?.tools?.[0]?.toolSpec?.name).toBe('registrar_borrador');
    expect(input?.inferenceConfig).toEqual({ maxTokens: 1500 });
  });

  it('el mensaje de sistema enviado no es diagnóstico y pide evidencia insuficiente', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [valida],
    });
    await proveedor(simulado).extraer(NOTA, contextoNivel7());
    const sistema = simulado.comandosConverse()[0]?.input.system?.[0]?.text ?? '';
    expect(sistema).toContain('estimación pedagógica para revisión de la educadora');
    expect(sistema).toContain('no es un diagnóstico');
    expect(sistema).toContain('evidenciaInsuficiente: true');
  });

  it('corrige en el segundo intento enviando los problemas como toolResult con error', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [inexistente, valida],
    });
    const borrador = cumpleContrato(await proveedor(simulado).extraer(NOTA, contextoNivel7()));
    expect(borrador.manifestaciones).toEqual([
      { idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló cuatro bloques solo' },
    ]);
    const [primero, segundo] = simulado.comandosConverse();
    expect(simulado.comandosConverse()).toHaveLength(2);
    expect(primero?.input.messages).toHaveLength(1);
    const mensajes = segundo?.input.messages ?? [];
    expect(mensajes).toHaveLength(3);
    expect(mensajes[0]).toEqual(primero?.input.messages?.[0]);
    expect(mensajes[1]).toEqual(inexistente.output?.message);
    const resultado = mensajes[2]?.content?.[0]?.toolResult;
    expect(mensajes[2]?.role).toBe('user');
    expect(resultado?.toolUseId).toBe('uso-inexistente');
    expect(resultado?.status).toBe('error');
    expect(JSON.stringify(resultado?.content)).toContain('MAN-L99-XX-01 no está en el catálogo');
  });

  it('con dos respuestas inválidas devuelve evidencia insuficiente', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [inexistente, inexistente],
    });
    const borrador = cumpleContrato(await proveedor(simulado).extraer(NOTA, contextoNivel7()));
    expect(borrador).toEqual(insuficiente(NOTA));
    expect(simulado.comandosConverse()).toHaveLength(2);
  });

  it('una respuesta sin herramienta entra al reintento con un mensaje de texto', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [respuestaTexto('Creo que corresponde al nivel 7.'), valida],
    });
    const borrador = cumpleContrato(await proveedor(simulado).extraer(NOTA, contextoNivel7()));
    expect(borrador.evidenciaInsuficiente).toBe(false);
    const mensajes = simulado.comandosConverse()[1]?.input.messages ?? [];
    expect(mensajes).toHaveLength(3);
    const bloque: ContentBlock | undefined = mensajes[2]?.content?.[0];
    expect(bloque?.toolResult).toBeUndefined();
    expect(bloque?.text).toContain('no se usó la herramienta registrar_borrador');
  });

  it('una respuesta sin contenido termina en evidencia insuficiente sin reintento', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [respuestaVacia()],
    });
    expect(await proveedor(simulado).extraer(NOTA, contextoNivel7())).toEqual(insuficiente(NOTA));
    expect(simulado.comandosConverse()).toHaveLength(1);
  });

  it('si el modelo declara evidencia insuficiente ignora nivel y manifestaciones', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: true,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'Apiló' }],
        }),
      ],
    });
    expect(await proveedor(simulado).extraer(NOTA, contextoNivel7())).toEqual(insuficiente(NOTA));
    expect(simulado.comandosConverse()).toHaveLength(1);
  });

  it('una nota demasiado corta no llama a Bedrock', async () => {
    const simulado = crearClienteSimulado();
    expect(await proveedor(simulado).extraer('Asistió hoy.', contextoNivel7())).toEqual(
      insuficiente('Asistió hoy.'),
    );
    expect(simulado.send).not.toHaveBeenCalled();
  });

  it('la lectura de una foto sin actividad no llama a Bedrock', async () => {
    const simulado = crearClienteSimulado();
    expect(
      await proveedor(simulado).extraer('Sin actividad observable.', contextoNivel7()),
    ).toEqual(insuficiente('Sin actividad observable.'));
    expect(simulado.send).not.toHaveBeenCalled();
  });

  it('una cita que no se puede ubicar en el original cuenta como problema del intento', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailAnonimiza('{NAME} dijo papá al ver la foto.')],
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-LC-01', cita: 'dijo papá' }],
        }),
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-LC-01', cita: '{NAME} dijo' }],
        }),
      ],
    });
    const nota = 'Martina Rojas dijo mamá al ver la foto.';
    const borrador = cumpleContrato(await proveedor(simulado).extraer(nota, contextoNivel7()));
    expect(borrador.manifestaciones).toEqual([
      { idManifestacion: 'MAN-L07-LC-01', cita: 'Martina Rojas dijo' },
    ]);
    const resultado = simulado.comandosConverse()[1]?.input.messages?.[2]?.content?.[0]?.toolResult;
    expect(JSON.stringify(resultado?.content)).toContain(
      'no se pudo ubicar la cita de MAN-L07-LC-01 en el texto',
    );
  });
});

describe('ProveedorBedrock: protección de datos personales', () => {
  it('envía a Claude la nota anonimizada y no el nombre', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailAnonimiza('{NAME} dijo mamá')],
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-LC-01', cita: '{NAME} dijo mamá' }],
        }),
      ],
    });
    const borrador = await proveedor(simulado).extraer('Martina Rojas dijo mamá', contextoNivel7());
    const enviado = textoEnviado(simulado);
    expect(enviado).toContain('{NAME} dijo mamá');
    expect(enviado).not.toContain('Martina Rojas');
    expect(cumpleContrato(borrador)).toEqual({
      textoFuente: 'Martina Rojas dijo mamá',
      nivelSugerido: 7,
      evidenciaInsuficiente: false,
      manifestaciones: [{ idManifestacion: 'MAN-L07-LC-01', cita: 'Martina Rojas dijo mamá' }],
      proveedor: 'bedrock',
      modelo: MODELO,
    });
  });

  it('la solicitud solo lleva nota anonimizada, edad, nivel esperado y catálogo', async () => {
    const nota = 'Persona Ficticia Uno (RUT 11.111.111-1) apiló cuatro bloques solo.';
    const anonima = '{NAME} (RUT {rut-chileno}) apiló cuatro bloques solo.';
    const simulado = crearClienteSimulado({
      guardrail: [guardrailAnonimiza(anonima)],
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 7,
          manifestaciones: [{ idManifestacion: 'MAN-L07-MF-01', cita: 'apiló cuatro bloques' }],
        }),
      ],
    });
    // El llamador podría pasar más datos de los que pide el contrato; no deben llegar a Claude.
    const contexto = {
      ...contextoNivel7(),
      id_nino: 'NINO-FICTICIO-001',
      idNino: 'NINO-FICTICIO-001',
      id_captura: 'CAPTURA-FICTICIA-001',
      idCaptura: 'CAPTURA-FICTICIA-001',
      nombres: 'Persona Ficticia Uno',
      rut: '11.111.111-1',
    } as ContextoExtraccion;
    const borrador = cumpleContrato(await proveedor(simulado).extraer(nota, contexto));
    expect(borrador.textoFuente).toBe(nota);

    const comando = simulado.comandosConverse()[0];
    expect(Object.keys(comando?.input ?? {}).sort()).toEqual([
      'inferenceConfig',
      'messages',
      'modelId',
      'system',
      'toolConfig',
    ]);
    expect(comando?.input.messages).toHaveLength(1);
    expect(comando?.input.messages?.[0]?.content).toHaveLength(1);
    const enviado = textoEnviado(simulado);
    for (const prohibido of [
      'id_nino',
      'idNino',
      'id_captura',
      'idCaptura',
      'NINO-FICTICIO',
      'CAPTURA-FICTICIA',
      'Persona Ficticia',
      '11.111.111-1',
    ]) {
      expect(enviado).not.toContain(prohibido);
    }
    const mensaje = comando?.input.messages?.[0]?.content?.[0]?.text ?? '';
    expect(mensaje).toContain(`<nota>\n${anonima}\n</nota>`);
    expect(mensaje).toContain('Edad: 30 meses');
    expect(mensaje).toContain('Nivel de referencia (último validado): 7');
    expect(mensaje).toContain('- MAN-L07-MF-01 [MF] Apila 4 bloques');
  });

  it('falla cerrada si el Guardrail interviene sin texto de salida', async () => {
    const simulado = crearClienteSimulado({ guardrail: [guardrailSinTexto()], converse: [valida] });
    const error = await proveedor(simulado)
      .extraer(NOTA, contextoNivel7())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorIa);
    expect(error).toMatchObject({ name: 'ErrorIa', codigo: 'GUARDRAIL_NO_DISPONIBLE' });
    expect(simulado.comandosConverse()).toHaveLength(0);
  });

  it('falla cerrada si el Guardrail bloqueó en vez de anonimizar', async () => {
    const simulado = crearClienteSimulado({ guardrail: [guardrailBloquea()], converse: [valida] });
    await expect(proveedor(simulado).extraer(NOTA, contextoNivel7())).rejects.toMatchObject({
      codigo: 'GUARDRAIL_NO_DISPONIBLE',
    });
    expect(simulado.comandosConverse()).toHaveLength(0);
  });

  it('con el Guardrail sin intervenir envía el texto sin cambios', async () => {
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [valida],
    });
    await proveedor(simulado).extraer(NOTA, contextoNivel7());
    expect(simulado.comandosConverse()[0]?.input.messages?.[0]?.content?.[0]?.text).toContain(
      `<nota>\n${NOTA}\n</nota>`,
    );
  });

  it('sin Guardrail configurado no llama a ApplyGuardrail', async () => {
    const simulado = crearClienteSimulado({ converse: [valida] });
    const borrador = await proveedor(simulado, false).extraer(NOTA, contextoNivel7());
    expect(borrador.evidenciaInsuficiente).toBe(false);
    expect(simulado.comandosGuardrail()).toHaveLength(0);
    expect(textoEnviado(simulado)).toContain(NOTA);
  });
});

describe('ProveedorBedrock: rúbrica parametrizable', () => {
  it('con 8 niveles y 10 núcleos inventados muestra los núcleos y valida igual', async () => {
    const nota = 'Ordenó piezas de colores según el tamaño de cada una.';
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [
        respuestaHerramienta({
          evidenciaInsuficiente: false,
          nivel: 3,
          manifestaciones: [{ idManifestacion: 'RUB-N3-05', cita: 'Ordenó piezas de colores' }],
        }),
      ],
    });
    const contexto = { edadMeses: 20, nivelEsperado: 3, catalogo: catalogoOchoPorDiez() };
    const borrador = cumpleContrato(await proveedor(simulado).extraer(nota, contexto));
    expect(borrador.nivelSugerido).toBe(3);
    const enviado = simulado.comandosConverse()[0]?.input.messages?.[0]?.content?.[0]?.text ?? '';
    for (const nucleo of NUCLEOS_INVENTADOS) expect(enviado).toContain(`[${nucleo}]`);
  });
});

describe('ProveedorBedrock: errores del SDK', () => {
  const throttling = () =>
    new ThrottlingException({ message: 'Rate exceeded (simulado)', $metadata: {} });

  it('propaga ThrottlingException sin envolver y sin consumir el reintento', async () => {
    const error = throttling();
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [error, valida],
    });
    const rechazo = await proveedor(simulado)
      .extraer(NOTA, contextoNivel7())
      .catch((e: unknown) => e);
    expect(rechazo).toBe(error);
    expect((rechazo as Error).name).toBe('ThrottlingException');
    expect(rechazo).not.toBeInstanceOf(ErrorIa);
    expect(simulado.comandosConverse()).toHaveLength(1);
  });

  it('propaga ThrottlingException también durante el reintento', async () => {
    const error = throttling();
    const simulado = crearClienteSimulado({
      guardrail: [guardrailSinCambios()],
      converse: [inexistente, error],
    });
    await expect(proveedor(simulado).extraer(NOTA, contextoNivel7())).rejects.toBe(error);
    expect(simulado.comandosConverse()).toHaveLength(2);
  });

  it('propaga los errores del Guardrail sin llamar a Claude', async () => {
    const error = throttling();
    const simulado = crearClienteSimulado({ guardrail: [error], converse: [valida] });
    await expect(proveedor(simulado).extraer(NOTA, contextoNivel7())).rejects.toBe(error);
    expect(simulado.comandosConverse()).toHaveLength(0);
  });
});

describe('ProveedorBedrock.normalizarFoto', () => {
  it('envía los bytes y el formato con la instrucción fija de lectura', async () => {
    const imagen = new Uint8Array([1, 2, 3]);
    const simulado = crearClienteSimulado({
      converse: [respuestaTexto(' Apila bloques  de espuma sobre la mesa. ')],
    });
    expect(await proveedor(simulado).normalizarFoto(imagen, 'png')).toBe(
      'Apila bloques de espuma sobre la mesa.',
    );
    const input = simulado.comandosConverse()[0]?.input;
    const contenido = input?.messages?.[0]?.content ?? [];
    expect(contenido[0]?.image?.format).toBe('png');
    expect(contenido[0]?.image?.source?.bytes).toBe(imagen);
    expect(contenido[1]?.text).toBe(INSTRUCCION_FOTO);
    expect(input?.inferenceConfig).toEqual({ maxTokens: 300 });
    expect(simulado.comandosGuardrail()).toHaveLength(0);
  });

  it('rechaza una foto de 5 MB sin llamar al modelo', async () => {
    const simulado = crearClienteSimulado();
    const error = await proveedor(simulado)
      .normalizarFoto(new Uint8Array(5 * 1024 * 1024), 'jpeg')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorIa);
    expect(error).toMatchObject({ name: 'ErrorIa', codigo: 'FOTO_NO_VALIDA' });
    expect((error as Error).message).toContain('3,75 MB');
    expect(simulado.send).not.toHaveBeenCalled();
  });

  it('rechaza un formato distinto de JPEG o PNG sin llamar al modelo', async () => {
    const simulado = crearClienteSimulado();
    await expect(
      proveedor(simulado).normalizarFoto(new Uint8Array([1]), 'gif' as FormatoImagen),
    ).rejects.toMatchObject({ codigo: 'FOTO_NO_VALIDA' });
    expect(simulado.send).not.toHaveBeenCalled();
  });

  it('devuelve «Sin actividad observable.» y la extracción posterior es insuficiente', async () => {
    const simulado = crearClienteSimulado({
      converse: [respuestaTexto('Sin actividad observable.')],
    });
    const bedrock = proveedor(simulado);
    const texto = await bedrock.normalizarFoto(new Uint8Array([1]), 'jpeg');
    expect(texto).toBe('Sin actividad observable.');
    expect(await bedrock.extraer(texto, contextoNivel7())).toEqual(insuficiente(texto));
    expect(simulado.send).toHaveBeenCalledTimes(1);
  });

  it('devuelve «(sin texto reconocible)» si el modelo no responde texto', async () => {
    const simulado = crearClienteSimulado({ converse: [respuestaVacia()] });
    expect(await proveedor(simulado).normalizarFoto(new Uint8Array([1]), 'jpeg')).toBe(
      '(sin texto reconocible)',
    );
  });
});
