import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { Roles } from '../auth/decoradores';
import {
  PanelObservacionesQueryDto,
  PanelObservacionesResponseDto,
  PanelResumenQueryDto,
  PanelResumenResponseDto,
} from './dto';
import { ObservacionesService } from './observaciones.service';
import { PanelService } from './panel.service';

@ApiTags('supervision')
@ApiBearerAuth()
@Roles('supervisor')
@Controller('panel')
export class PanelController {
  constructor(
    private readonly panel: PanelService,
    private readonly observaciones: ObservacionesService,
  ) {}

  @Get('observaciones')
  @ApiOperation({
    operationId: 'listarPanelObservaciones',
    summary: 'Observaciones de todos, con filtros y paginadas',
  })
  @ZodResponse({ status: 200, type: PanelObservacionesResponseDto })
  listar(@Query() query: PanelObservacionesQueryDto) {
    return this.panel.listar(query);
  }

  @Get('resumen')
  @ApiOperation({
    operationId: 'obtenerPanelResumen',
    summary: 'Totales del día por criterio, estado y persona',
  })
  @ZodResponse({ status: 200, type: PanelResumenResponseDto })
  resumen(@Query() query: PanelResumenQueryDto) {
    return this.panel.resumen(query.fecha ?? this.observaciones.hoy());
  }
}
