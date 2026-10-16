import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import {
  EstadoSalaQuerySchema,
  EstadoSalaResponseSchema,
  ResumenJardinQuerySchema,
  ResumenJardinResponseSchema,
} from '@toqui/shared';
import { Grupos, IdentidadActual } from '../auth/decoradores';
import type { Identidad } from '../auth/identidad';
import { SalasService } from './salas.service';

class EstadoSalaQueryDto extends createZodDto(EstadoSalaQuerySchema) {}
class EstadoSalaResponseDto extends createZodDto(EstadoSalaResponseSchema) {}
class ResumenJardinQueryDto extends createZodDto(ResumenJardinQuerySchema) {}
class ResumenJardinResponseDto extends createZodDto(ResumenJardinResponseSchema) {}

@ApiTags('salas')
@ApiBearerAuth()
@Controller('salas')
export class SalasController {
  constructor(private readonly salas: SalasService) {}

  @Get('estado')
  @ApiOperation({
    operationId: 'obtenerEstadoSala',
    summary: 'Estado por núcleo de una sala al corte, con alertas para revisar en contexto',
  })
  @ZodResponse({ status: 200, type: EstadoSalaResponseDto })
  estado(@IdentidadActual() identidad: Identidad, @Query() query: EstadoSalaQueryDto) {
    return this.salas.estadoSala(identidad, query.sala, query.corte);
  }
}

@ApiTags('salas')
@ApiBearerAuth()
@Controller('jardin')
export class JardinController {
  constructor(private readonly salas: SalasService) {}

  @Get('resumen')
  @Grupos('directora')
  @ApiOperation({
    operationId: 'obtenerResumenJardin',
    summary: 'Vista general de la directora: todas las salas del jardín al corte',
  })
  @ZodResponse({ status: 200, type: ResumenJardinResponseDto })
  resumen(@IdentidadActual() identidad: Identidad, @Query() query: ResumenJardinQueryDto) {
    return this.salas.resumenJardin(identidad, query.corte);
  }
}
