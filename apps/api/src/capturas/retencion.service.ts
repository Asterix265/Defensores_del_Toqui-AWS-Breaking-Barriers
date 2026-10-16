import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/** Igual que la regla de ciclo de vida del bucket de capturas (`infra/lib/componentes.ts`). */
export const DIAS_RETENCION_CAPTURAS = 7;
const CADA_MS = 60 * 60 * 1000;

/**
 * Retención (endurecer-seguridad-aws, D6): el texto original (sin anonimizar) y la referencia al
 * audio o la foto no viven en la base más que en S3. Se conservan el borrador con el texto
 * anonimizado, la observación y los metadatos. Idempotente: varias tareas pueden correrla a la vez.
 */
@Injectable()
export class RetencionService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RetencionService.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap(): void {
    // En las pruebas se llama a `purgar` directamente.
    if (this.env.NODE_ENV === 'test') return;
    void this.ejecutar();
    this.temporizador = setInterval(() => void this.ejecutar(), CADA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }

  /** Vacía `texto` y `archivo_clave` de las capturas creadas antes del plazo. Devuelve cuántas. */
  async purgar(ahora = new Date()): Promise<number> {
    const limite = new Date(ahora.getTime() - DIAS_RETENCION_CAPTURAS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.captura.updateMany({
      where: {
        creadoEn: { lt: limite },
        OR: [{ texto: { not: null } }, { archivoClave: { not: null } }],
      },
      data: { texto: null, archivoClave: null },
    });
    return count;
  }

  private async ejecutar(): Promise<void> {
    try {
      const purgadas = await this.purgar();
      if (purgadas > 0) this.logger.log(`Retención: ${purgadas} captura(s) sin el original`);
    } catch (error) {
      this.logger.error('Falló la retención de capturas', error as Error);
    }
  }
}
