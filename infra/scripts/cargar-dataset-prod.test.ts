import { StopTaskCommand, type ECSClient } from '@aws-sdk/client-ecs';
import { describe, expect, it, vi } from 'vitest';
import { PREFIJO_DATASET } from '../lib/app-stack.js';
import { esperarODetener, impedimentoStack } from './cargar-dataset-prod.js';

const SALIDAS = { BucketCapturas: 'toqui-prod-capturas-1', PrefijoDataset: PREFIJO_DATASET };
const ARN = 'arn:aws:ecs:us-east-1:111111111111:task/toqui-prod/abc123';

describe('impedimentoStack', () => {
  it('permite la carga con el último despliegue terminado y este cambio desplegado', () => {
    expect(impedimentoStack('UPDATE_COMPLETE', SALIDAS)).toBeNull();
    expect(impedimentoStack('CREATE_COMPLETE', SALIDAS)).toBeNull();
  });

  it('se niega tras un rollback o con un despliegue en curso', () => {
    for (const estado of ['UPDATE_ROLLBACK_COMPLETE', 'UPDATE_IN_PROGRESS', 'ROLLBACK_COMPLETE']) {
      expect(impedimentoStack(estado, SALIDAS)).toContain(`ToquiApp está en ${estado}`);
    }
  });

  it('se niega si el stack desplegado no tiene migrar-dataset-nucleos', () => {
    const { PrefijoDataset, ...anteriores } = SALIDAS;
    void PrefijoDataset;
    expect(impedimentoStack('UPDATE_COMPLETE', anteriores)).toContain('--cargar-dataset');
  });
});

describe('esperarODetener', () => {
  const ecsFalso = (send: ReturnType<typeof vi.fn>) => ({ send }) as unknown as ECSClient;

  it('no detiene la tarea si termina dentro del plazo', async () => {
    const send = vi.fn();
    await esperarODetener(ecsFalso(send), ARN, async () => ({ state: 'SUCCESS' }));
    expect(send).not.toHaveBeenCalled();
  });

  it('si la espera falla, detiene la tarea y propaga el error', async () => {
    const send = vi.fn().mockResolvedValue({});
    await expect(
      esperarODetener(ecsFalso(send), ARN, () => Promise.reject(new Error('Waiter has timed out'))),
    ).rejects.toThrow(/Waiter has timed out.*se pidió detenerla/);
    expect(send).toHaveBeenCalledTimes(1);
    const [comando] = send.mock.calls[0]!;
    expect(comando).toBeInstanceOf(StopTaskCommand);
    expect(comando.input).toMatchObject({ cluster: 'toqui-prod', task: ARN });
  });

  it('si tampoco puede detenerla, indica cómo hacerlo a mano', async () => {
    const send = vi.fn().mockRejectedValue(new Error('AccessDenied'));
    await expect(
      esperarODetener(ecsFalso(send), ARN, () => Promise.reject(new Error('Waiter has timed out'))),
    ).rejects.toThrow(`aws ecs stop-task --cluster toqui-prod --task ${ARN}`);
  });
});
