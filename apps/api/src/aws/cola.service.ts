import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GetQueueAttributesCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { MensajeCapturaSchema, type MensajeCaptura } from '@toqui/shared';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Cola de capturas (D4): cada mensaje dispara una ejecución de la Lambda de proceso. */
@Injectable()
export class ColaService {
  private readonly sqs: SQSClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.sqs = new SQSClient({ region: env.AWS_REGION });
  }

  /** Valida el mensaje contra el contrato compartido antes de enviarlo: nada sin validar sale de la API. */
  async enviar(mensaje: MensajeCaptura): Promise<void> {
    const cuerpo = MensajeCapturaSchema.parse(mensaje);
    await this.sqs.send(
      new SendMessageCommand({ QueueUrl: this.url(), MessageBody: JSON.stringify(cuerpo) }),
    );
  }

  /** `GetQueueAttributes` con las credenciales de la API, para `/health`. */
  async comprobar(abortSignal?: AbortSignal): Promise<void> {
    await this.sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: this.url(), AttributeNames: ['QueueArn'] }),
      { abortSignal },
    );
  }

  private url(): string {
    if (!this.env.SQS_URL_CAPTURAS) {
      throw new ServiceUnavailableException('Cola de capturas no configurada');
    }
    return this.env.SQS_URL_CAPTURAS;
  }
}
