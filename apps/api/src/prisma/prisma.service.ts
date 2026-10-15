import { readFileSync } from 'node:fs';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';

/** Cliente Prisma compartido. Se conecta de forma diferida en la primera consulta. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    // En AWS, Aurora exige TLS: se verifica con el bundle de CA de RDS incluido en la imagen.
    const ssl = env.DATABASE_SSL_CA ? { ca: readFileSync(env.DATABASE_SSL_CA, 'utf8') } : undefined;
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL, ssl }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
