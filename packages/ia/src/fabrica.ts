import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { ProveedorBedrock } from './bedrock.js';
import { ErrorIa } from './errores.js';
import { ProveedorFake } from './fake.js';
import type { ConfigIa, IaProvider } from './proveedor.js';

/**
 * Proveedor según la configuración explícita del llamador (no lee variables de entorno).
 * Con `bedrock` el Guardrail es obligatorio salvo `sinGuardrail: true`.
 */
export function crearProveedor(config: ConfigIa): IaProvider {
  if (config.proveedor === 'fake') return new ProveedorFake();
  if (config.proveedor !== 'bedrock') {
    throw new ErrorIa(
      'CONFIGURACION_INVALIDA',
      `Proveedor de IA desconocido: ${String((config as { proveedor?: unknown }).proveedor)}.`,
    );
  }
  if (!config.modelo) {
    throw new ErrorIa('CONFIGURACION_INVALIDA', 'Falta el modelo de Bedrock.');
  }
  const { guardrail } = config;
  if (guardrail && (!guardrail.id || !guardrail.version)) {
    throw new ErrorIa('CONFIGURACION_INVALIDA', 'El Guardrail necesita id y versión.');
  }
  if (!guardrail && config.sinGuardrail !== true) {
    throw new ErrorIa(
      'CONFIGURACION_INVALIDA',
      'Bedrock requiere un Guardrail; usa sinGuardrail: true solo en desarrollo local.',
    );
  }
  const cliente =
    config.cliente ?? new BedrockRuntimeClient(config.region ? { region: config.region } : {});
  return new ProveedorBedrock({
    cliente,
    modelo: config.modelo,
    ...(guardrail ? { guardrail } : {}),
  });
}
