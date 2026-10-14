import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { HealthResponseDto } from './health.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ operationId: 'getHealth', summary: 'Estado de la API y de la base de datos' })
  @ZodResponse({ status: 200, type: HealthResponseDto })
  check() {
    return this.health.check();
  }
}
