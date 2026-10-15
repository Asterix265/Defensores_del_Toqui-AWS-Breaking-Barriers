import { Inject, Injectable, Logger } from '@nestjs/common';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Mensaje que recibe la Lambda de proceso. */
export interface MensajeObservacion {
  idObservacion: string;
}

/** Encola observaciones para la Lambda de proceso. */
@Injectable()
export class ColaService {
  private readonly logger = new Logger(ColaService.name);
  private readonly sqs: SQSClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.sqs = new SQSClient({
      region: env.AWS_REGION,
      ...(env.SQS_ENDPOINT && { endpoint: env.SQS_ENDPOINT }),
    });
  }

  async encolar(mensaje: MensajeObservacion): Promise<void> {
    if (!this.env.SQS_QUEUE_URL) {
      // Solo en desarrollo (la configuración la exige en producción): la observación queda pendiente.
      this.logger.warn(`SQS_QUEUE_URL no configurada; ${mensaje.idObservacion} no se encola`);
      return;
    }
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify(mensaje),
      }),
    );
  }
}
