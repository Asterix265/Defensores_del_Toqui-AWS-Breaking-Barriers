import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@toqui/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => 'up' as const)
      .catch(() => 'down' as const);

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      version: process.env['npm_package_version'] ?? '0.0.0',
      timestamp: new Date().toISOString(),
      dependencies: { database },
    };
  }
}
