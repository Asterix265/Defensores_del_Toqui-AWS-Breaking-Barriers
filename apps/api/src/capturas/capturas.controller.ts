import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import {
  ArchivoResponseSchema,
  CapturaDetalleSchema,
  ConfirmacionRequestSchema,
  CrearCapturaRequestSchema,
  CrearCapturaResponseSchema,
  ListarCapturasQuerySchema,
  ListarCapturasResponseSchema,
} from '@toqui/shared';
import { Grupos, IdentidadActual } from '../auth/decoradores';
import type { Identidad } from '../auth/identidad';
import { PipelineInlineService } from '../pipeline/pipeline-inline.service';
import { CapturasService } from './capturas.service';

class CrearCapturaRequestDto extends createZodDto(CrearCapturaRequestSchema) {}
class CrearCapturaResponseDto extends createZodDto(CrearCapturaResponseSchema) {}
class CapturaDetalleDto extends createZodDto(CapturaDetalleSchema) {}
class ListarCapturasQueryDto extends createZodDto(ListarCapturasQuerySchema) {}
class ListarCapturasResponseDto extends createZodDto(ListarCapturasResponseSchema) {}
class ConfirmacionRequestDto extends createZodDto(ConfirmacionRequestSchema) {}
class ArchivoResponseDto extends createZodDto(ArchivoResponseSchema) {}

@ApiTags('capturas')
@ApiBearerAuth()
@Controller('capturas')
export class CapturasController {
  constructor(
    private readonly capturas: CapturasService,
    private readonly pipeline: PipelineInlineService,
  ) {}

  @Post()
  @Grupos('educadora')
  @ApiOperation({
    operationId: 'crearCaptura',
    summary: 'Registra una nota (texto, audio o foto) de un niño o niña del jardín',
  })
  @ZodResponse({ status: 201, type: CrearCapturaResponseDto })
  async crear(@IdentidadActual() identidad: Identidad, @Body() body: CrearCapturaRequestDto) {
    const { id, subida } = await this.capturas.crear(identidad, body);
    if (this.pipeline.activo) this.pipeline.programar(id);
    return { captura: await this.capturas.detalle(identidad, id), subida };
  }

  @Get()
  @ApiOperation({
    operationId: 'listarCapturas',
    summary: 'Notas del jardín, con filtros por fecha, sala, niño, estado y autoría',
  })
  @ZodResponse({ status: 200, type: ListarCapturasResponseDto })
  listar(@IdentidadActual() identidad: Identidad, @Query() query: ListarCapturasQueryDto) {
    return this.capturas.listar(identidad, query);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'obtenerCaptura',
    summary: 'Estado, borrador y observación confirmada',
  })
  @ZodResponse({ status: 200, type: CapturaDetalleDto })
  obtener(@IdentidadActual() identidad: Identidad, @Param('id') id: string) {
    return this.capturas.detalle(identidad, id);
  }

  @Post(':id/confirmacion')
  @HttpCode(200)
  @Grupos('educadora')
  @ApiOperation({
    operationId: 'confirmarCaptura',
    summary: 'Confirma el borrador tal cual o corregido; guarda la corrección',
  })
  @ZodResponse({ status: 200, type: CapturaDetalleDto })
  confirmar(
    @IdentidadActual() identidad: Identidad,
    @Param('id') id: string,
    @Body() body: ConfirmacionRequestDto,
  ) {
    return this.capturas.confirmar(identidad, id, body);
  }

  @Post(':id/descarte')
  @HttpCode(200)
  @Grupos('educadora')
  @ApiOperation({
    operationId: 'descartarCaptura',
    summary: 'Descarta el borrador sin crear observación',
  })
  @ZodResponse({ status: 200, type: CapturaDetalleDto })
  descartar(@IdentidadActual() identidad: Identidad, @Param('id') id: string) {
    return this.capturas.descartar(identidad, id);
  }

  @Get(':id/archivo')
  @ApiOperation({
    operationId: 'obtenerArchivoCaptura',
    summary: 'URL temporal del audio o foto original',
  })
  @ZodResponse({ status: 200, type: ArchivoResponseDto })
  archivo(@IdentidadActual() identidad: Identidad, @Param('id') id: string) {
    return this.capturas.archivo(identidad, id);
  }
}
