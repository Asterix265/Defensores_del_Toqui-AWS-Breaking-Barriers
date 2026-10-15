import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProveedorBedrock, ProveedorFake, type FormatoImagen, type IaProvider } from '@toqui/ia';
import { AlmacenamientoService } from '../aws/almacenamiento.service';
import { CapturasService, type ArchivoSubido } from '../capturas/capturas.service';
import { desdeColumnaFecha, edadEnMeses } from '../comun/fechas';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { PASOS, describirProcesamiento, lecturaDeEjemplo, type Paso } from './procesamiento';

const FORMATOS_IMAGEN: Record<string, FormatoImagen> = { 'image/jpeg': 'jpeg', 'image/png': 'png' };

/**
 * `PIPELINE_MODE=inline`: los pasos del pipeline (normalizar → extraer → entregar) corren
 * dentro de la API con el módulo `@toqui/ia`, el mismo que usará el pipeline de AWS. Con
 * `IA_PROVIDER=fake` todo es simulado; con `bedrock`, el texto y la foto pasan por Guardrail y
 * Claude reales. El audio sigue con un texto de ejemplo hasta conectar Transcribe.
 */
@Injectable()
export class PipelineInlineService {
  private readonly logger = new Logger(PipelineInlineService.name);
  private readonly bedrock: ProveedorBedrock | null;
  private readonly ia: IaProvider;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly capturas: CapturasService,
    private readonly almacenamiento: AlmacenamientoService,
  ) {
    this.bedrock =
      env.IA_PROVIDER === 'bedrock'
        ? new ProveedorBedrock({
            modelo: env.BEDROCK_MODEL_EXTRACCION,
            region: env.AWS_REGION,
            ...(env.BEDROCK_GUARDRAIL_ID &&
              env.BEDROCK_GUARDRAIL_VERSION && {
                guardrail: { id: env.BEDROCK_GUARDRAIL_ID, version: env.BEDROCK_GUARDRAIL_VERSION },
              }),
          })
        : null;
    this.ia = this.bedrock ?? new ProveedorFake();
  }

  get activo(): boolean {
    return this.env.PIPELINE_MODE === 'inline';
  }

  /** Procesa en segundo plano, sin demorar la respuesta. Audio y foto llegan con su archivo en S3. */
  programar(idCaptura: string, archivo?: ArchivoSubido): void {
    setImmediate(() => {
      this.procesar(idCaptura, archivo).catch(async (error: unknown) => {
        this.logger.error(`Falló el pipeline inline de ${idCaptura}`, error as Error);
        await this.capturas
          .registrarErrorPipeline(idCaptura, 'No se pudo procesar la nota')
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
    const pasos: Paso[] = [];
    const textoFuente = await this.normalizar(idCaptura, formato, captura.texto, archivo, pasos);

    const edadMeses = Math.max(
      0,
      edadEnMeses(
        desdeColumnaFecha(captura.nino.fechaNacimiento),
        desdeColumnaFecha(captura.fecha),
      ),
    );
    const nivelEsperado = await this.nivelEsperado(edadMeses);
    // Catálogo de los niveles esperado ±1 (D7); el proveedor fake usa solo el esperado.
    const catalogo = await this.prisma.manifestacion.findMany({
      where: { nivel: { gte: nivelEsperado - 1, lte: nivelEsperado + 1 } },
      select: { id: true, nivel: true, dominio: true, textoObservable: true },
      orderBy: { id: 'asc' },
    });
    const borrador = await this.ia.extraer(textoFuente, { edadMeses, nivelEsperado, catalogo });
    pasos.push(
      this.bedrock
        ? PASOS.extraccionClaude(this.bedrock.modelo, Boolean(this.env.BEDROCK_GUARDRAIL_ID))
        : PASOS.extraccionSimulada,
    );
    await this.capturas.registrarBorrador(idCaptura, {
      ...borrador,
      procesamiento: describirProcesamiento(formato, captura.texto, archivo, pasos),
    });
  }

  /** Texto del que salen las citas: el escrito, la lectura de la foto o un texto de ejemplo. */
  private async normalizar(
    idCaptura: string,
    formato: 'texto' | 'audio' | 'foto',
    texto: string | null,
    archivo: ArchivoSubido | undefined,
    pasos: Paso[],
  ): Promise<string> {
    if (formato === 'texto') return texto ?? '';
    const formatoImagen = archivo && FORMATOS_IMAGEN[archivo.tipo];
    if (formato === 'foto' && this.bedrock && archivo && formatoImagen) {
      const imagen = await this.almacenamiento.descargar(archivo.clave);
      const lectura = await this.bedrock.describirFoto(imagen, formatoImagen);
      pasos.push(PASOS.lecturaClaude(this.bedrock.modelo));
      return lectura;
    }
    pasos.push(formato === 'audio' ? PASOS.transcripcionPendiente : PASOS.lecturaPendiente);
    return lecturaDeEjemplo(formato, idCaptura);
  }

  /** Nivel de la ruta cuyo rango de edad contiene la edad; el último si la supera. */
  private async nivelEsperado(edadMeses: number): Promise<number> {
    const niveles = await this.prisma.nivel.findMany({ orderBy: { nivel: 'asc' } });
    const enRango = niveles.find((n) => edadMeses >= n.edadMinMeses && edadMeses < n.edadMaxMeses);
    return enRango?.nivel ?? niveles.at(-1)?.nivel ?? 1;
  }
}
