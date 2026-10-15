import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { IdentidadActual, Roles } from '../auth/decoradores';
import type { Identidad } from '../auth/identidad';
import { AlmacenamientoService } from '../aws/almacenamiento.service';
import {
  ArchivoResponseDto,
  CrearObservacionRequestDto,
  CrearObservacionResponseDto,
  CrearSubidaRequestDto,
  CrearSubidaResponseDto,
  DecisionRequestDto,
  MiDiaQueryDto,
  MiDiaResponseDto,
  ObservacionDetalleDto,
} from './dto';
import { ObservacionesService } from './observaciones.service';

@ApiTags('registro')
@ApiBearerAuth()
@Controller('subidas')
export class SubidasController {
  constructor(private readonly almacenamiento: AlmacenamientoService) {}

  @Post()
  @Roles('registrador')
  @ApiOperation({
    operationId: 'crearSubida',
    summary: 'URL temporal para subir un audio o foto a S3',
  })
  @ZodResponse({ status: 201, type: CrearSubidaResponseDto })
  crear(@IdentidadActual() identidad: Identidad, @Body() body: CrearSubidaRequestDto) {
    return this.almacenamiento.firmarSubida(identidad.id, body.tipo, body.tamano);
  }
}

@ApiTags('registro')
@ApiBearerAuth()
@Controller('observaciones')
export class ObservacionesController {
  constructor(private readonly observaciones: ObservacionesService) {}

  @Post()
  @Roles('registrador')
  @ApiOperation({
    operationId: 'crearObservacion',
    summary: 'Crea la observación como pendiente y la encola',
  })
  @ZodResponse({ status: 201, type: CrearObservacionResponseDto })
  crear(@IdentidadActual() identidad: Identidad, @Body() body: CrearObservacionRequestDto) {
    return this.observaciones.crear(identidad, body);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'obtenerObservacion',
    summary: 'Estado y propuesta de una observación',
  })
  @ZodResponse({ status: 200, type: ObservacionDetalleDto })
  obtener(@IdentidadActual() identidad: Identidad, @Param('id') id: string) {
    return this.observaciones.detalle(identidad, id);
  }

  @Post(':id/revision')
  @HttpCode(200)
  @Roles('registrador')
  @ApiOperation({
    operationId: 'revisarObservacion',
    summary: 'El registrador confirma o corrige el criterio',
  })
  @ZodResponse({ status: 200, type: ObservacionDetalleDto })
  revisar(
    @IdentidadActual() identidad: Identidad,
    @Param('id') id: string,
    @Body() body: DecisionRequestDto,
  ) {
    return this.observaciones.revisar(identidad, id, body.criterioId);
  }

  @Post(':id/validacion')
  @HttpCode(200)
  @Roles('supervisor')
  @ApiTags('supervision')
  @ApiOperation({
    operationId: 'validarObservacion',
    summary: 'El supervisor valida o corrige el criterio',
  })
  @ZodResponse({ status: 200, type: ObservacionDetalleDto })
  validar(
    @IdentidadActual() identidad: Identidad,
    @Param('id') id: string,
    @Body() body: DecisionRequestDto,
  ) {
    return this.observaciones.validar(identidad, id, body.criterioId);
  }

  @Get(':id/archivo')
  @ApiOperation({
    operationId: 'obtenerArchivoObservacion',
    summary: 'URL temporal del audio o foto original',
  })
  @ZodResponse({ status: 200, type: ArchivoResponseDto })
  archivo(@IdentidadActual() identidad: Identidad, @Param('id') id: string) {
    return this.observaciones.archivo(identidad, id);
  }
}

@ApiTags('registro')
@ApiBearerAuth()
@Controller('mi-dia')
export class MiDiaController {
  constructor(private readonly observaciones: ObservacionesService) {}

  @Get()
  @Roles('registrador')
  @ApiOperation({
    operationId: 'obtenerMiDia',
    summary: 'Observaciones propias del día con su estado',
  })
  @ZodResponse({ status: 200, type: MiDiaResponseDto })
  miDia(@IdentidadActual() identidad: Identidad, @Query() query: MiDiaQueryDto) {
    return this.observaciones.miDia(identidad, query.fecha);
  }
}
