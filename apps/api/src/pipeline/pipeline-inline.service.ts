import { Injectable, Logger } from '@nestjs/common';
import { CapturasService, type ArchivoSubido } from '../capturas/capturas.service';
import { SELECT_MANIFESTACION, aManifestacion } from '../catalogo/catalogo.service';
import { PrismaService } from '../prisma/prisma.service';
import { extraerFake, normalizarFake, procesamientoFake } from './ia-fake';
import { nivelReferencia } from './nivel';

/**
 * `PIPELINE_MODE=inline`: los pasos del pipeline (normalizar → extraer → entregar) corren
 * dentro de la API, con el proveedor `fake`. Solo para desarrollo y demo sin AWS. Lo invoca el
 * `DespachadorService`, que garantiza una sola ejecución por captura.
 */
@Injectable()
export class PipelineInlineService {
  private readonly logger = new Logger(PipelineInlineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capturas: CapturasService,
  ) {}

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
        nino: { select: { id: true, idNivelEducativo: true } },
      },
    });
    const formato = captura.formato === 'video' ? 'audio' : captura.formato;
    const textoFuente = normalizarFake(formato, idCaptura, captura.texto);
    const nivel = await nivelReferencia(this.prisma, captura.nino.id);
    const catalogo = (
      await this.prisma.manifestacion.findMany({
        where: { descriptor: { nivel, idNivelEducativo: captura.nino.idNivelEducativo } },
        select: SELECT_MANIFESTACION,
      })
    ).map(aManifestacion);
    await this.capturas.registrarBorrador(idCaptura, {
      ...extraerFake(textoFuente, nivel, catalogo),
      procesamiento: procesamientoFake(formato, captura.texto, archivo),
    });
  }
}
