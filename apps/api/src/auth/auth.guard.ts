import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Grupo } from '@toqui/shared';
import { GRUPOS, PUBLICO } from './decoradores';
import { USUARIO_LOCAL, VerificadorToken } from './verificador-token';

/**
 * Guardia global sin estado: verifica el token y el grupo de la ruta.
 * 401 sin token válido; 403 sin grupo o jardín, o con un grupo que no corresponde.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verificador: VerificadorToken,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destinos)) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');

    let identidad = USUARIO_LOCAL;
    if (esquema || token || !this.verificador.modoLocal) {
      if (esquema !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token');
      const resultado = await this.verificador.verificar(token);
      if (!resultado.ok) {
        if (resultado.motivo === 'sin_permiso') {
          throw new ForbiddenException('Usuario sin grupo o jardín asignado');
        }
        throw new UnauthorizedException('Token inválido');
      }
      identidad = resultado.identidad;
    }

    const grupos = this.reflector.getAllAndOverride<Grupo[] | undefined>(GRUPOS, destinos);
    if (grupos && !grupos.includes(identidad.grupo)) {
      throw new ForbiddenException('No tiene permiso para esta acción');
    }
    req.identidad = identidad;
    return true;
  }
}
