import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AuthModule } from './auth/auth.module';
import { AwsModule } from './aws/aws.module';
import { ConfigModule } from './config/config.module';
import { CriteriosModule } from './criterios/criterios.module';
import { HealthModule } from './health/health.module';
import { ObservacionesModule } from './observaciones/observaciones.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AwsModule,
    AuthModule,
    HealthModule,
    CriteriosModule,
    ObservacionesModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
