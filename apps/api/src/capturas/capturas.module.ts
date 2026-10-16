import { Module } from '@nestjs/common';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { DespachadorService } from '../pipeline/despachador.service';
import { EjemplosService } from '../pipeline/ejemplos.service';
import { PipelineInlineService } from '../pipeline/pipeline-inline.service';
import { CapturasController } from './capturas.controller';
import { CapturasService } from './capturas.service';
import { InternoController } from './interno.controller';
import { RetencionService } from './retencion.service';

@Module({
  imports: [CatalogoModule],
  controllers: [CapturasController, InternoController],
  providers: [
    CapturasService,
    PipelineInlineService,
    DespachadorService,
    EjemplosService,
    RetencionService,
  ],
})
export class CapturasModule {}
