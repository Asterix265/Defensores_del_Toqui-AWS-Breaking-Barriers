import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import {
  BorradorEntranteSchema,
  CapturaEstadoResponseSchema,
  ContextoCapturaSchema,
  ErrorPipelineRequestSchema,
} from '@toqui/shared';
import { Publico } from '../auth/decoradores';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { CapturasService } from './capturas.service';

class BorradorEntranteDto extends createZodDto(BorradorEntranteSchema) {}
class ErrorPipelineRequestDto extends createZodDto(ErrorPipelineRequestSchema) {}
class CapturaEstadoResponseDto extends createZodDto(CapturaEstadoResponseSchema) {}
class ContextoCapturaDto extends createZodDto(ContextoCapturaSchema) {}

/** Cabecera con el secreto compartido entre el pipeline y la API. */
export const CABECERA_PIPELINE = 'x-pipeline-token';

/**
 * Endpoint interno del pipeline (D6): las Lambdas no tocan la base y entregan aquí el resultado.
 * No usa Cognito: se autoriza con `PIPELINE_TOKEN`.
 */
@ApiTags('interno')
@ApiHeader({ name: CABECERA_PIPELINE, required: true })
@Publico()
@Controller('interno/capturas')
export class InternoController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly capturas: CapturasService,
  ) {}

  @Get(':id/contexto')
  @ApiOperation({
    operationId: 'obtenerContextoCaptura',
    summary: 'El pipeline obtiene el texto, la edad y el catálogo para extraer',
  })
  @ZodResponse({ status: 200, type: ContextoCapturaDto })
  contexto(@Headers(CABECERA_PIPELINE) token: string | undefined, @Param('id') id: string) {
    this.autorizar(token);
    return this.capturas.contexto(id);
  }

  @Post(':id/borrador')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'entregarBorrador',
    summary: 'El pipeline entrega el borrador (idempotente por captura)',
  })
  @ZodResponse({ status: 200, type: CapturaEstadoResponseDto })
  borrador(
    @Headers(CABECERA_PIPELINE) token: string | undefined,
    @Param('id') id: string,
    @Body() body: BorradorEntranteDto,
  ) {
    this.autorizar(token);
    return this.capturas.registrarBorrador(id, body);
  }

  @Post(':id/error')
  @HttpCode(200)
  @ApiOperation({ operationId: 'informarErrorPipeline', summary: 'El pipeline informa un fallo' })
  @ZodResponse({ status: 200, type: CapturaEstadoResponseDto })
  error(
    @Headers(CABECERA_PIPELINE) token: string | undefined,
    @Param('id') id: string,
    @Body() body: ErrorPipelineRequestDto,
  ) {
    this.autorizar(token);
    return this.capturas.registrarErrorPipeline(id, body.detalle);
  }

  private autorizar(token: string | undefined): void {
    const esperado = this.env.PIPELINE_TOKEN;
    if (!esperado) throw new ServiceUnavailableException('Endpoint interno no configurado');
    const a = Buffer.from(token ?? '');
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Token del pipeline inválido');
    }
  }
}
