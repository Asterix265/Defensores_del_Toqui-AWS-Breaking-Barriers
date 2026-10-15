import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from '@toqui/shared';
import type { Identidad } from './identidad';

export const PUBLICO = 'auth:publico';
export const ROLES = 'auth:roles';

/** Ruta sin autenticación (solo `/health`). */
export const Publico = () => SetMetadata(PUBLICO, true);

/** Restringe la ruta a estos roles; sin el decorador basta con estar autenticado. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

/** Identidad del token, ya verificada por `AuthGuard`. */
export const IdentidadActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Identidad => {
    const identidad = ctx.switchToHttp().getRequest<Request>().identidad;
    if (!identidad) throw new Error('IdentidadActual usado en una ruta pública');
    return identidad;
  },
);
