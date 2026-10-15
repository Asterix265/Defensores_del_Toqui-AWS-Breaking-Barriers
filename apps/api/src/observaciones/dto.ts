import { createZodDto } from 'nestjs-zod';
import {
  ArchivoResponseSchema,
  CrearObservacionRequestSchema,
  CrearObservacionResponseSchema,
  CrearSubidaRequestSchema,
  CrearSubidaResponseSchema,
  DecisionRequestSchema,
  MiDiaQuerySchema,
  MiDiaResponseSchema,
  ObservacionDetalleSchema,
  PanelObservacionesQuerySchema,
  PanelObservacionesResponseSchema,
  PanelResumenQuerySchema,
  PanelResumenResponseSchema,
} from '@toqui/shared';

export class CrearSubidaRequestDto extends createZodDto(CrearSubidaRequestSchema) {}
export class CrearSubidaResponseDto extends createZodDto(CrearSubidaResponseSchema) {}
export class CrearObservacionRequestDto extends createZodDto(CrearObservacionRequestSchema) {}
export class CrearObservacionResponseDto extends createZodDto(CrearObservacionResponseSchema) {}
export class ObservacionDetalleDto extends createZodDto(ObservacionDetalleSchema) {}
export class DecisionRequestDto extends createZodDto(DecisionRequestSchema) {}
export class ArchivoResponseDto extends createZodDto(ArchivoResponseSchema) {}
export class MiDiaQueryDto extends createZodDto(MiDiaQuerySchema) {}
export class MiDiaResponseDto extends createZodDto(MiDiaResponseSchema) {}
export class PanelObservacionesQueryDto extends createZodDto(PanelObservacionesQuerySchema) {}
export class PanelObservacionesResponseDto extends createZodDto(PanelObservacionesResponseSchema) {}
export class PanelResumenQueryDto extends createZodDto(PanelResumenQuerySchema) {}
export class PanelResumenResponseDto extends createZodDto(PanelResumenResponseSchema) {}
