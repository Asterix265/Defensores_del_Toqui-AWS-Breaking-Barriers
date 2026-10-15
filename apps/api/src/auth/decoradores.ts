import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Grupo } from '@toqui/shared';
import type { Identidad } from './identidad';

export const PUBLICO = 'auth:publico';
export const GRUPOS = 'auth:grupos';

/** Ruta sin token de Cognito (`/health` y el endpoint interno del pipeline, que usa su propio secreto). */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Restringe la ruta a estos grupos; sin el decorador basta con estar autenticado. */
export const Grupos = (...grupos: Grupo[]) => SetMetadata(GRUPOS, grupos);

/** Identidad del token, ya verificada por `AuthGuard`. */
export const IdentidadActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Identidad => {
    const identidad = ctx.switchToHttp().getRequest<Request>().identidad;
    if (!identidad) throw new Error('IdentidadActual usado en una ruta pública');
    return identidad;
  },
);
