import { Module } from '@nestjs/common';
import {
  ManifestacionesController,
  NinosController,
  NivelesController,
  NucleosController,
} from './catalogo.controller';
import { CatalogoService } from './catalogo.service';

@Module({
  controllers: [NinosController, ManifestacionesController, NivelesController, NucleosController],
  providers: [CatalogoService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
