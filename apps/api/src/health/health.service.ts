import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DependencyStatus, HealthResponse } from '@toqui/shared';
import { AlmacenamientoService } from '../aws/almacenamiento.service';
import { ColaService } from '../aws/cola.service';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/** Tiempo máximo por dependencia: el health check del ALB no debe quedar colgado. */
export const LIMITE_COMPROBACION_MS = 2000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  /** Último estado de cada dependencia, para registrar solo los cambios y no cada consulta del ALB. */
  private readonly ultimo = new Map<string, DependencyStatus>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly cola: ColaService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, storage, queue] = await Promise.all([
      this.comprobar('base de datos', () => this.prisma.$queryRaw`SELECT 1`),
      this.comprobar('almacenamiento', (senal) => this.almacenamiento.comprobarBucket(senal)),
      // En modo inline no hay cola: la API procesa sola.
      this.env.PIPELINE_MODE === 'cola'
        ? this.comprobar('cola', (senal) => this.cola.comprobar(senal))
        : Promise.resolve('up' as const),
    ]);

    return {
      status: database === 'up' && storage === 'up' && queue === 'up' ? 'ok' : 'degraded',
      version: process.env['npm_package_version'] ?? '0.0.0',
      timestamp: new Date().toISOString(),
      dependencies: { database, storage, queue },
    };
  }

  /** `down` si la comprobación falla o no responde a tiempo. La causa va al log, no a la respuesta pública. */
  private async comprobar(
    nombre: string,
    fn: (senal: AbortSignal) => Promise<unknown>,
  ): Promise<DependencyStatus> {
    const senal = AbortSignal.timeout(LIMITE_COMPROBACION_MS);
    const limite = new Promise<never>((_, rechazar) =>
      senal.addEventListener(
        'abort',
        () => rechazar(new Error(`sin respuesta en ${LIMITE_COMPROBACION_MS} ms`)),
        { once: true },
      ),
    );
    let causa: unknown;
    const estado = await Promise.race([fn(senal), limite]).then(
      () => 'up' as const,
      (error: unknown) => {
        causa = error;
        return 'down' as const;
      },
    );

    if (this.ultimo.get(nombre) !== estado) {
      if (estado === 'down') this.logger.warn(`Sin conexión con ${nombre}: ${describir(causa)}`);
      else if (this.ultimo.has(nombre)) this.logger.log(`Conexión con ${nombre} restablecida`);
      this.ultimo.set(nombre, estado);
    }
    return estado;
  }
}

function describir(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const http = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return `${error.name}${http ? ` (HTTP ${http})` : ''}: ${error.message}`;
}
