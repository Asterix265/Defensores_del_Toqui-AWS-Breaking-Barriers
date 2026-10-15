import { Module } from '@nestjs/common';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { PipelineInlineService } from '../pipeline/pipeline-inline.service';
import { CapturasController } from './capturas.controller';
import { CapturasService } from './capturas.service';
import { InternoController } from './interno.controller';

@Module({
  imports: [CatalogoModule],
  controllers: [CapturasController, InternoController],
  providers: [CapturasService, PipelineInlineService],
})
export class CapturasModule {}
