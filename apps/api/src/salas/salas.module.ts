import { Module } from '@nestjs/common';
import { JardinController, SalasController } from './salas.controller';
import { SalasService } from './salas.service';

@Module({
  controllers: [SalasController, JardinController],
  providers: [SalasService],
})
export class SalasModule {}
