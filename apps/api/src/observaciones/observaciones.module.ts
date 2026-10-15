import { Module } from '@nestjs/common';
import { CriteriosModule } from '../criterios/criterios.module';
import {
  MiDiaController,
  ObservacionesController,
  SubidasController,
} from './observaciones.controller';
import { ObservacionesService } from './observaciones.service';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';

@Module({
  imports: [CriteriosModule],
  controllers: [SubidasController, ObservacionesController, MiDiaController, PanelController],
  providers: [ObservacionesService, PanelService],
})
export class ObservacionesModule {}
