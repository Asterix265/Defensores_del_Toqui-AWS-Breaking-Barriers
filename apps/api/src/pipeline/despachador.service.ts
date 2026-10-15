import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { MensajeCaptura, TipoArchivo } from '@toqui/shared';
import { ColaService } from '../aws/cola.service';
import { desdeColumnaFecha, edadEnMeses } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { nivelEsperado } from './nivel';
import { PipelineInlineService } from './pipeline-inline.service';

/** Lo que ve la educadora si la nota no se pudo enviar a procesar. */
export const DETALLE_SIN_COLA = 'No se pudo enviar la nota a procesar; intenta de nuevo';

/**
 * Despachador (D1): manda cada captura a procesar una sola vez. Con `PIPELINE_MODE=cola` la encola
 * en SQS con un mensaje autosuficiente (D3); con `inline` corre los pasos dentro de la API.
 */
@Injectable()
export class DespachadorService {
  private readonly logger = new Logger(DespachadorService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly cola: ColaService,
    private readonly inline: PipelineInlineService,
  ) {}

  /**
   * Idempotente por captura (D2): solo la primera llamada sobre una captura en `procesando` la
   * despacha. Si el envío falla, la captura pasa a `error` y responde 503.
   */
  async programar(idCaptura: string): Promise<void> {
    const { count } = await this.prisma.captura.updateMany({
      where: { id: idCaptura, estado: 'procesando', encoladaEn: null },
      data: { encoladaEn: new Date() },
    });
    if (count === 0) return;

    if (this.env.PIPELINE_MODE === 'inline') {
      this.inline.programar(idCaptura);
      return;
    }
    try {
      await this.cola.enviar(await this.mensaje(idCaptura));
    } catch (error) {
      this.logger.error(`No se pudo encolar ${idCaptura}`, error as Error);
      await this.prisma.captura.updateMany({
        where: { id: idCaptura, estado: 'procesando' },
        data: { estado: 'error', errorDetalle: DETALLE_SIN_COLA },
      });
      throw new ServiceUnavailableException(DETALLE_SIN_COLA);
    }
  }

  /** Mensaje de la cola: lo justo para procesar, sin `id_nino`, nombres ni RUT. */
  private async mensaje(idCaptura: string): Promise<MensajeCaptura> {
    const c = await this.prisma.captura.findUniqueOrThrow({
      where: { id: idCaptura },
      select: {
        idUsuario: true,
        idJardin: true,
        formato: true,
        texto: true,
        archivoClave: true,
        archivoTipo: true,
        fecha: true,
        nino: { select: { fechaNacimiento: true } },
      },
    });
    const edadMeses = edadEnMeses(
      desdeColumnaFecha(c.nino.fechaNacimiento),
      desdeColumnaFecha(c.fecha),
    );
    const nivel = await nivelEsperado(this.prisma, edadMeses);
    // Catálogo completo (90 manifestaciones, ~15 KB): la IA puede proponer cualquier nivel.
    const catalogo = await this.prisma.manifestacion.findMany({
      select: { id: true, nivel: true, dominio: true, textoObservable: true },
      orderBy: [{ nivel: 'asc' }, { id: 'asc' }],
    });
    const base = {
      version: 1 as const,
      idCaptura,
      idUsuario: c.idUsuario,
      idJardin: c.idJardin,
      edadMeses,
      nivelEsperado: nivel,
      catalogo,
    };
    if (c.formato === 'texto') return { ...base, formato: 'texto', texto: c.texto ?? '' };
    if (c.formato === 'audio' || c.formato === 'foto') {
      return {
        ...base,
        formato: c.formato,
        archivoClave: c.archivoClave ?? '',
        archivoTipo: (c.archivoTipo ?? '') as TipoArchivo,
      } as MensajeCaptura;
    }
    throw new Error(`Formato sin procesamiento: ${c.formato}`);
  }
}
