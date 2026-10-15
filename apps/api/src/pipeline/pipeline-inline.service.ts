import { Inject, Injectable, Logger } from '@nestjs/common';
import { CapturasService } from '../capturas/capturas.service';
import { desdeColumnaFecha, edadEnMeses } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { extraerFake, normalizarFake } from './ia-fake';
import { nivelEsperado } from './nivel';

/**
 * `PIPELINE_MODE=inline`: los pasos del pipeline (normalizar → extraer → entregar) corren
 * dentro de la API, con el proveedor `fake`. Solo para desarrollo y demo sin AWS. Lo invoca el
 * `DespachadorService`, que garantiza una sola ejecución por captura.
 */
@Injectable()
export class PipelineInlineService {
  private readonly logger = new Logger(PipelineInlineService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly capturas: CapturasService,
  ) {}

  get activo(): boolean {
    return this.env.PIPELINE_MODE === 'inline';
  }

  /** Procesa en segundo plano, sin demorar la respuesta. */
  programar(idCaptura: string): void {
    setImmediate(() => {
      this.procesar(idCaptura).catch(async (error: unknown) => {
        this.logger.error(`Falló el pipeline inline de ${idCaptura}`, error as Error);
        await this.capturas
          .registrarErrorPipeline(idCaptura, 'Falló el procesamiento simulado')
          .catch(() => undefined);
      });
    });
  }

  async procesar(idCaptura: string): Promise<void> {
    const captura = await this.prisma.captura.findUniqueOrThrow({
      where: { id: idCaptura },
      select: {
        formato: true,
        texto: true,
        fecha: true,
        nino: { select: { fechaNacimiento: true } },
      },
    });
    const formato = captura.formato === 'video' ? 'audio' : captura.formato;
    const textoFuente = normalizarFake(formato, idCaptura, captura.texto);
    const edad = edadEnMeses(
      desdeColumnaFecha(captura.nino.fechaNacimiento),
      desdeColumnaFecha(captura.fecha),
    );
    const nivel = await nivelEsperado(this.prisma, edad);
    const catalogo = await this.prisma.manifestacion.findMany({
      where: { nivel },
      select: { id: true, nivel: true, dominio: true, textoObservable: true },
    });
    await this.capturas.registrarBorrador(idCaptura, extraerFake(textoFuente, nivel, catalogo));
  }
}
