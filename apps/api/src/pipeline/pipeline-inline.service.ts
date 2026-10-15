import { Inject, Injectable, Logger } from '@nestjs/common';
import { CapturasService, type ArchivoSubido } from '../capturas/capturas.service';
import { desdeColumnaFecha, edadEnMeses } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { extraerFake, normalizarFake, procesamientoFake } from './ia-fake';

/**
 * `PIPELINE_MODE=inline`: los pasos del pipeline (normalizar → extraer → entregar) corren
 * dentro de la API, con el proveedor `fake`. Solo para desarrollo y demo sin AWS.
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

  /** Procesa en segundo plano, sin demorar la respuesta. Audio y foto llegan con su archivo en S3. */
  programar(idCaptura: string, archivo?: ArchivoSubido): void {
    setImmediate(() => {
      this.procesar(idCaptura, archivo).catch(async (error: unknown) => {
        this.logger.error(`Falló el pipeline inline de ${idCaptura}`, error as Error);
        await this.capturas
          .registrarErrorPipeline(idCaptura, 'Falló el procesamiento simulado')
          .catch(() => undefined);
      });
    });
  }

  async procesar(idCaptura: string, archivo?: ArchivoSubido): Promise<void> {
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
    const nivel = await this.nivelEsperado(edad);
    const catalogo = await this.prisma.manifestacion.findMany({
      where: { nivel },
      select: { id: true, nivel: true, dominio: true, textoObservable: true },
    });
    await this.capturas.registrarBorrador(idCaptura, {
      ...extraerFake(textoFuente, nivel, catalogo),
      procesamiento: procesamientoFake(formato, captura.texto, archivo),
    });
  }

  /** Nivel de la ruta cuyo rango de edad contiene la edad; el último si la supera. */
  private async nivelEsperado(edadMeses: number): Promise<number> {
    const niveles = await this.prisma.nivel.findMany({ orderBy: { nivel: 'asc' } });
    const enRango = niveles.find((n) => edadMeses >= n.edadMinMeses && edadMeses < n.edadMaxMeses);
    return enRango?.nivel ?? niveles.at(-1)?.nivel ?? 1;
  }
}
