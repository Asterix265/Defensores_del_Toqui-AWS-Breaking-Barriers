import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { MensajeCaptura, NivelEducativo, TipoArchivo } from '@toqui/shared';
import { ColaService } from '../aws/cola.service';
import type { ArchivoSubido } from '../capturas/capturas.service';
import { SELECT_MANIFESTACION, aManifestacion } from '../catalogo/catalogo.service';
import { desdeColumnaFecha, edadEnMeses } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { EjemplosService } from './ejemplos.service';
import { nivelReferencia } from './nivel';
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
    private readonly ejemplos: EjemplosService,
  ) {}

  /**
   * Idempotente por captura (D2): solo la primera llamada sobre una captura en `procesando` la
   * despacha. Si el envío falla, la captura pasa a `error` y responde 503. `archivo` es el que
   * comprobó `verificarSubida`: el modo inline lo usa para declarar el procesamiento; la cola
   * no lo necesita, porque el mensaje se arma desde la base.
   */
  async programar(idCaptura: string, archivo?: ArchivoSubido): Promise<void> {
    const { count } = await this.prisma.captura.updateMany({
      where: { id: idCaptura, estado: 'procesando', encoladaEn: null },
      data: { encoladaEn: new Date() },
    });
    if (count === 0) return;

    if (this.env.PIPELINE_MODE === 'inline') {
      this.inline.programar(idCaptura, archivo);
      return;
    }
    try {
      await this.cola.enviar(await this.mensaje(idCaptura, archivo));
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
  private async mensaje(idCaptura: string, archivo?: ArchivoSubido): Promise<MensajeCaptura> {
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
        nino: { select: { id: true, fechaNacimiento: true, idNivelEducativo: true } },
      },
    });
    const edadMeses = edadEnMeses(
      desdeColumnaFecha(c.nino.fechaNacimiento),
      desdeColumnaFecha(c.fecha),
    );
    const nivelEducativo = c.nino.idNivelEducativo as NivelEducativo;
    // Catálogo del nivel educativo (192 manifestaciones, ~40 KB): cualquier núcleo y nivel (D7).
    const catalogo = (
      await this.prisma.manifestacion.findMany({
        where: { descriptor: { idNivelEducativo: nivelEducativo } },
        select: SELECT_MANIFESTACION,
        orderBy: [{ descriptor: { nivel: 'asc' } }, { id: 'asc' }],
      })
    ).map(aManifestacion);
    const base = {
      version: 1 as const,
      idCaptura,
      idUsuario: c.idUsuario,
      idJardin: c.idJardin,
      edadMeses,
      nivelEducativo,
      nivelEsperado: await nivelReferencia(this.prisma, c.nino.id),
      catalogo,
      ejemplos: await this.ejemplos.ejemplos({
        idJardin: c.idJardin,
        nivelEducativo,
        catalogo: new Set(catalogo.map((m) => m.id)),
        excluir: idCaptura,
      }),
    };
    if (c.formato === 'texto') return { ...base, formato: 'texto', texto: c.texto ?? '' };
    if (c.formato === 'audio' || c.formato === 'foto') {
      return {
        ...base,
        formato: c.formato,
        archivoClave: c.archivoClave ?? '',
        archivoTipo: (c.archivoTipo ?? '') as TipoArchivo,
        ...(archivo && { archivoBytes: archivo.bytes }),
      } as MensajeCaptura;
    }
    throw new Error(`Formato sin procesamiento: ${c.formato}`);
  }
}
