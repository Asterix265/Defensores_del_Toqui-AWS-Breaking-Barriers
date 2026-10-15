import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Rol } from '@toqui/shared';
import { PUBLICO, ROLES } from './decoradores';
import { UsuariosService } from './usuarios.service';
import { VerificadorToken } from './verificador-token';

/**
 * Guardia global: verifica el token, registra a la persona y revisa el rol de la ruta.
 * 401 sin token válido; 403 si el rol no corresponde.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verificador: VerificadorToken,
    private readonly usuarios: UsuariosService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, destinos)) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');
    if (esquema !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token');

    const resultado = await this.verificador.verificar(token);
    if (!resultado.ok) {
      if (resultado.motivo === 'sin_rol') throw new ForbiddenException('Usuario sin rol asignado');
      throw new UnauthorizedException('Token inválido');
    }

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, destinos);
    if (roles && !roles.includes(resultado.identidad.rol)) {
      throw new ForbiddenException('No tiene permiso para esta acción');
    }

    // El rol sale del token; nombre y teléfono se completan con lo guardado si el token no los trae.
    req.identidad = await this.usuarios.sincronizar(resultado.identidad);
    return true;
  }
}
