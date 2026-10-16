import { Module } from '@nestjs/common';
import { CuentasController } from './cuentas.controller';
import { CuentasService } from './cuentas.service';
import { DirectorioService } from './directorio.service';

@Module({
  controllers: [CuentasController],
  providers: [CuentasService, DirectorioService],
})
export class CuentasModule {}
