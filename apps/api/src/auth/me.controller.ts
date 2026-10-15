import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { MeResponseSchema } from '@toqui/shared';
import { IdentidadActual } from './decoradores';
import type { Identidad } from './identidad';

class MeResponseDto extends createZodDto(MeResponseSchema) {}

@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ operationId: 'getMe', summary: 'Quién es la persona, su grupo y su jardín' })
  @ZodResponse({ status: 200, type: MeResponseDto })
  me(@IdentidadActual() identidad: Identidad) {
    return identidad;
  }
}
