import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import {
  ManifestacionesQuerySchema,
  ManifestacionSchema,
  NinoSchema,
  NinosQuerySchema,
  TrayectoriaQuerySchema,
  TrayectoriaResponseSchema,
} from '@toqui/shared';
import { IdentidadActual } from '../auth/decoradores';
import type { Identidad } from '../auth/identidad';
import { CatalogoService } from './catalogo.service';

class NinoDto extends createZodDto(NinoSchema) {}
class NinosQueryDto extends createZodDto(NinosQuerySchema) {}
class ManifestacionDto extends createZodDto(ManifestacionSchema) {}
class ManifestacionesQueryDto extends createZodDto(ManifestacionesQuerySchema) {}
class TrayectoriaQueryDto extends createZodDto(TrayectoriaQuerySchema) {}
class TrayectoriaResponseDto extends createZodDto(TrayectoriaResponseSchema) {}

@ApiTags('ninos')
@ApiBearerAuth()
@Controller('ninos')
export class NinosController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  @ApiOperation({ operationId: 'listarNinos', summary: 'Niños y niñas del jardín, por sala' })
  @ZodResponse({ status: 200, type: [NinoDto] })
  listar(@IdentidadActual() identidad: Identidad, @Query() query: NinosQueryDto) {
    return this.catalogo.ninos(identidad, query.sala);
  }

  @Get(':id/trayectoria')
  @ApiOperation({
    operationId: 'obtenerTrayectoria',
    summary: 'Observaciones por dominio en el periodo (por defecto, 180 días)',
  })
  @ZodResponse({ status: 200, type: TrayectoriaResponseDto })
  trayectoria(
    @IdentidadActual() identidad: Identidad,
    @Param('id') id: string,
    @Query() query: TrayectoriaQueryDto,
  ) {
    return this.catalogo.trayectoria(identidad, id, query);
  }
}

@ApiTags('catalogo')
@ApiBearerAuth()
@Controller('manifestaciones')
export class ManifestacionesController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  @ApiOperation({
    operationId: 'listarManifestaciones',
    summary: 'Catálogo de manifestaciones, filtrable por nivel y dominio',
  })
  @ZodResponse({ status: 200, type: [ManifestacionDto] })
  listar(@Query() query: ManifestacionesQueryDto) {
    return this.catalogo.manifestaciones(query);
  }
}
