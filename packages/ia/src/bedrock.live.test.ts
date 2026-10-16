import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { BorradorEntranteSchema } from '@toqui/shared';
import { describe, expect, it } from 'vitest';
import { crearProveedor } from './fabrica.js';
import {
  HERRAMIENTA_BORRADOR,
  mensajeExtraccion,
  NOMBRE_HERRAMIENTA,
  SISTEMA_EXTRACCION,
} from './prompt.js';
import { contextoNivel7 } from './pruebas/catalogos.js';
import { sinCredenciales } from './pruebas/sin-credenciales.js';

/*
 * Prueba manual contra Bedrock real. Solo corre con RUN_BEDROCK_LIVE=1 y credenciales del
 * perfil `toqui` (AWS_PROFILE), además de BEDROCK_GUARDRAIL_ID y BEDROCK_GUARDRAIL_VERSION
 * (de `pnpm aws:env`). Nunca corre en CI. La nota es sintética, con datos ficticios.
 */

const REGION = 'us-east-1';
const MODELO = 'us.anthropic.claude-sonnet-5';
const NOTA =
  'Persona Ficticia Uno, RUT 11.111.111-1, apiló cuatro bloques sola y aplaudió cuando no se cayeron.';

describe.skipIf(process.env.RUN_BEDROCK_LIVE !== '1')('Bedrock real', () => {
  it('extrae un borrador válido con Guardrail y citas del texto original', async () => {
    const proveedor = crearProveedor({
      proveedor: 'bedrock',
      modelo: MODELO,
      region: REGION,
      guardrail: {
        id: process.env.BEDROCK_GUARDRAIL_ID ?? '',
        version: process.env.BEDROCK_GUARDRAIL_VERSION ?? '',
      },
    });
    const borrador = await sinCredenciales(proveedor.extraer(NOTA, contextoNivel7()));
    console.info(
      'Borrador de Bedrock:',
      JSON.stringify({
        nivel: borrador.nivelSugerido,
        ids: borrador.manifestaciones.map((m) => m.idManifestacion),
      }),
    );
    expect(BorradorEntranteSchema.parse(borrador)).toEqual(borrador);
    expect(borrador.textoFuente).toBe(NOTA);
    for (const m of borrador.manifestaciones) expect(NOTA).toContain(m.cita);
  }, 60_000);

  it('registra si el modelo acepta toolChoice forzado', async () => {
    const cliente = new BedrockRuntimeClient({ region: REGION });
    const respuesta = await cliente
      .send(
        new ConverseCommand({
          modelId: MODELO,
          system: [{ text: SISTEMA_EXTRACCION }],
          messages: [
            {
              role: 'user',
              content: [
                { text: mensajeExtraccion('{NAME} apiló cuatro bloques sola.', contextoNivel7()) },
              ],
            },
          ],
          toolConfig: {
            tools: [{ toolSpec: HERRAMIENTA_BORRADOR }],
            toolChoice: { tool: { name: NOMBRE_HERRAMIENTA } },
          },
          inferenceConfig: { maxTokens: 1500 },
        }),
      )
      .catch((error: unknown) => error as Error);
    if (respuesta instanceof Error) {
      console.info(`toolChoice forzado rechazado: ${respuesta.name}: ${respuesta.message}`);
      expect(respuesta.name).toBe('ValidationException');
      return;
    }
    const usoHerramienta = respuesta.output?.message?.content?.some(
      (b) => b.toolUse?.name === NOMBRE_HERRAMIENTA,
    );
    console.info(`toolChoice forzado aceptado; usó la herramienta: ${String(usoHerramienta)}`);
    expect(usoHerramienta).toBe(true);
  }, 60_000);
});
