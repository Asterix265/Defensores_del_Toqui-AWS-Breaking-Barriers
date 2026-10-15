import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { MeController } from './me.controller';
import { VerificadorToken } from './verificador-token';

@Module({
  controllers: [MeController],
  providers: [VerificadorToken, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
