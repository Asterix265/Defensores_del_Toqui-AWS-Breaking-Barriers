import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import {
  ManifestacionesQuerySchema,
  ManifestacionSchema,
  NinoSchema,
  NinosQuerySchema,
  NivelRutaSchema,
  NucleoCatalogoSchema,
  TrayectoriaQuerySchema,
  TrayectoriaResponseSchema,
} from '@toqui/shared';
import { IdentidadActual } from '../auth/decoradores';
import type { Identidad } from '../auth/identidad';
import { CatalogoService } from './catalogo.service';

class NinoDto extends createZodDto(NinoSchema) {}
class NinosQueryDto extends createZodDto(NinosQuerySchema) {}
class ManifestacionDto extends createZodDto(ManifestacionSchema) {}
class NivelRutaDto extends createZodDto(NivelRutaSchema) {}
class NucleoDto extends createZodDto(NucleoCatalogoSchema) {}
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
    summary: 'Valoraciones y observaciones por núcleo en el periodo (por defecto, 180 días)',
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
    summary: 'Catálogo de manifestaciones, filtrable por núcleo, nivel educativo y nivel',
  })
  @ZodResponse({ status: 200, type: [ManifestacionDto] })
  listar(@Query() query: ManifestacionesQueryDto) {
    return this.catalogo.manifestaciones(query);
  }
}

@ApiTags('catalogo')
@ApiBearerAuth()
@Controller('niveles')
export class NivelesController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  @ApiOperation({
    operationId: 'listarNiveles',
    summary: 'Nombres de los 8 niveles de la trayectoria (sin edades)',
  })
  @ZodResponse({ status: 200, type: [NivelRutaDto] })
  listar() {
    return this.catalogo.niveles();
  }
}

@ApiTags('catalogo')
@ApiBearerAuth()
@Controller('nucleos')
export class NucleosController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get()
  @ApiOperation({
    operationId: 'listarNucleos',
    summary: 'Núcleos de aprendizaje; `origen` distingue la referencia aportada de las propuestas',
  })
  @ZodResponse({ status: 200, type: [NucleoDto] })
  listar() {
    return this.catalogo.nucleos();
  }
}
