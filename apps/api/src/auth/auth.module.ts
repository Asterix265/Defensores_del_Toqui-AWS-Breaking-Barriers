import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { MeController } from './me.controller';
import { UsuariosService } from './usuarios.service';
import { VerificadorToken } from './verificador-token';

@Module({
  controllers: [MeController],
  providers: [VerificadorToken, UsuariosService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
