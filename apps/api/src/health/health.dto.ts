import { createZodDto } from 'nestjs-zod';
import { HealthResponseSchema } from '@toqui/shared';

export class HealthResponseDto extends createZodDto(HealthResponseSchema) {}
