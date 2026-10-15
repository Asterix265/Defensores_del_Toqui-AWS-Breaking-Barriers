import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProveedorBedrock, ProveedorFake, normalizarFake, type IaProvider } from '@toqui/ia';
import { CapturasService } from '../capturas/capturas.service';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/**
 * `PIPELINE_MODE=inline`: los pasos del pipeline (normalizar → extraer → entregar) corren
 * dentro de la API con el mismo módulo `@toqui/ia` de las Lambdas. Solo para desarrollo y como
 * respaldo de la demo. Audio y foto usan lecturas simuladas: no se espera el archivo.
 */
@Injectable()
export class PipelineInlineService {
  private readonly logger = new Logger(PipelineInlineService.name);
  private readonly ia: IaProvider;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly capturas: CapturasService,
  ) {
    this.ia =
      env.IA_PROVIDER === 'bedrock'
        ? new ProveedorBedrock({
            modelo: env.BEDROCK_MODEL_EXTRACCION,
            region: env.AWS_REGION,
            ...(env.BEDROCK_GUARDRAIL_ID &&
              env.BEDROCK_GUARDRAIL_VERSION && {
                guardrail: { id: env.BEDROCK_GUARDRAIL_ID, version: env.BEDROCK_GUARDRAIL_VERSION },
              }),
          })
        : new ProveedorFake();
  }

  get activo(): boolean {
    return this.env.PIPELINE_MODE === 'inline';
  }

  /** Procesa en segundo plano, sin demorar la respuesta. */
  programar(idCaptura: string): void {
    setImmediate(() => {
      this.procesar(idCaptura).catch(async (error: unknown) => {
        this.logger.error(`Falló el pipeline inline de ${idCaptura}`, error as Error);
        await this.capturas
          .registrarErrorPipeline(idCaptura, 'No se pudo procesar la nota')
          .catch(() => undefined);
      });
    });
  }

  async procesar(idCaptura: string): Promise<void> {
    const contexto = await this.capturas.contexto(idCaptura);
    const texto = normalizarFake(contexto.formato, idCaptura, contexto.texto);
    await this.capturas.registrarBorrador(idCaptura, await this.ia.extraer(texto, contexto));
  }
}
