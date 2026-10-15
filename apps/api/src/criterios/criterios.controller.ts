import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CriterioSchema } from '@toqui/shared';
import { CriteriosService } from './criterios.service';

class CriterioDto extends createZodDto(CriterioSchema) {}

@ApiTags('comun')
@ApiBearerAuth()
@Controller('criterios')
export class CriteriosController {
  constructor(private readonly criterios: CriteriosService) {}

  @Get()
  @ApiOperation({
    operationId: 'listarCriterios',
    summary: 'Lista fija de criterios para los botones de corrección',
  })
  @ZodResponse({ status: 200, type: [CriterioDto] })
  listar() {
    return this.criterios.listar();
  }
}
