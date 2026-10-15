import { Module } from '@nestjs/common';
import { ManifestacionesController, NinosController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';

@Module({
  controllers: [NinosController, ManifestacionesController],
  providers: [CatalogoService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
