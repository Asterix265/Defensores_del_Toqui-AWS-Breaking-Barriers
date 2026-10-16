import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import {
  CuentaResponseSchema,
  InvitarCuentaRequestSchema,
  ListarCuentasResponseSchema,
} from '@toqui/shared';
import { Grupos, IdentidadActual } from '../auth/decoradores';
import type { Identidad } from '../auth/identidad';
import { CuentasService } from './cuentas.service';

class ListarCuentasResponseDto extends createZodDto(ListarCuentasResponseSchema) {}
class InvitarCuentaRequestDto extends createZodDto(InvitarCuentaRequestSchema) {}
class CuentaResponseDto extends createZodDto(CuentaResponseSchema) {}

/** Solo la directora administra las cuentas de su jardín. */
@ApiTags('cuentas')
@ApiBearerAuth()
@Grupos('directora')
@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}

  @Get()
  @ApiOperation({ operationId: 'listarCuentas', summary: 'Cuentas del jardín de la directora' })
  @ZodResponse({ status: 200, type: ListarCuentasResponseDto })
  async listar(@IdentidadActual() identidad: Identidad) {
    return { cuentas: await this.cuentas.listar(identidad) };
  }

  @Post()
  @ApiOperation({
    operationId: 'invitarCuenta',
    summary: 'Crea una cuenta del jardín; Cognito envía la contraseña temporal por correo',
  })
  @ZodResponse({ status: 201, type: CuentaResponseDto })
  async invitar(@IdentidadActual() identidad: Identidad, @Body() body: InvitarCuentaRequestDto) {
    return { cuenta: await this.cuentas.invitar(identidad, body) };
  }

  @Post(':usuario/reenvio')
  @HttpCode(200)
  @ApiOperation({ operationId: 'reenviarInvitacion', summary: 'Reenvía la contraseña temporal' })
  @ZodResponse({ status: 200, type: CuentaResponseDto })
  async reenviar(@IdentidadActual() identidad: Identidad, @Param('usuario') usuario: string) {
    return { cuenta: await this.cuentas.reenviar(identidad, usuario) };
  }

  @Post(':usuario/desactivacion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'desactivarCuenta', summary: 'Desactiva una cuenta del jardín' })
  @ZodResponse({ status: 200, type: CuentaResponseDto })
  async desactivar(@IdentidadActual() identidad: Identidad, @Param('usuario') usuario: string) {
    return { cuenta: await this.cuentas.habilitar(identidad, usuario, false) };
  }

  @Post(':usuario/activacion')
  @HttpCode(200)
  @ApiOperation({ operationId: 'activarCuenta', summary: 'Reactiva una cuenta del jardín' })
  @ZodResponse({ status: 200, type: CuentaResponseDto })
  async activar(@IdentidadActual() identidad: Identidad, @Param('usuario') usuario: string) {
    return { cuenta: await this.cuentas.habilitar(identidad, usuario, true) };
  }
}
